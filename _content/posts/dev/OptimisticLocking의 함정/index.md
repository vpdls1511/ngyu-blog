---
title: "OptimisticLocking의 함정"
date: "2025-08-17"
excerpt: "ObjectOptimisticLockingFailureException이 동시성 오류가 아니라고?"
coverImage: ""
---

# 이건뭘까
리팩터링 중이었다. 평소처럼 잘 동작하던 결제 API가 갑자기 예외를 던지기 시작했다.

```commandline
org.springframework.orm.ObjectOptimisticLockingFailureException: Row was updated or deleted by another transaction
```

"동시성 문제다."
바로 직감했다. `OptimisticLocking`이라는 단어가 눈에 들어왔고, 분명 여러 요청이 동시에 같은 결제를 수정하려다 충돌한 거라고 확신했다.

## 뭔가 이상하다
동시성 문제는 **여러 트랜잭션이 하나의 자원에 동시에 접근**할 때 발생한다.   
하지만, 나는 **혼자 Postman을 통한 요청을 보내고 있었다.**  

동시성은 아닌 것 같았다.

# 원인 추적
리팩터링 전에는 문제가 없었다. 그렇다면 리팩토링 과정에서 뭔가 잘못됐을 것이다.

나는 `paymentId`, `orderId` 등 비즈니스 ID 생성을 도메인에서 외부로 분리하고,  
JPA 자동 생성 대신 **DB 시퀀스를 직접 관리**하도록 변경했다.

```kotlin
// 변경 후
val paymentSeq = sequenceGenerator.nextPaymentId()  // 시퀀스 직접 생성
val paymentId = Payment.createPaymentId(paymentSeq)
val domain = request.toDomain(paymentSeq, paymentId)
```

문제는 여기서 시작됐다.

## 문제 해결 과정
이런 오류는 완전 처음 보는 거라 의심되는것들 하나하나 다 확인해보았다.

### saveAndFlush()
repository.saveAndFlush()가 의심스러웠다.
하지만 save()로 바꿔도 동일한 에러 발생했다..

@Transactional 사용 중이라 어차피 트랜잭션 종료 시 flush되므로 불필요한 saveAndFlush()는 제거했다

### 상태 전이
상태를 변경하는 동시에 저장하는 로직이 의심스러웠다.
```kotlin
val updateDomain = paymentRepository.save(domain.inProgress())
```

두 번 저장으로 분리해봤지만 여전히 에러가 발생했고, 현재 단계에서 중간 검증이 없어 비효율적이라 판단하고 원복.

### Sequence
리팩토링 하기 전으로 돌아와 보았다.
1. 기존 row의 id는 JPA를 통해 저장할 시 auto_increment로 아이디를 생성했다.
2. 이 id를 기반으로 paymentId, orderId와같은 비즈니스 ID를 생성했다.

내 리팩토링은 위 단계를 DB에 의존하지 않고 Domain 단에서 하기 위함이었다.  
**이 생각이 내 무릎을 탁 쳤다!**

```kotlin
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
val id: Long
```

아, 생각해보니 기존에 id를 만들 때 `@GeneratedValue`를 통해 id를 생성하고 있던것이 생각났다.  
id의 생성 시점은 db에 write될 때가 아닌, domain의 생성 시점이라는 점이 위 오류를 발생한것이라는 추측을 했다.  
이 추측을 바탕으로, @GeneratedValue를 제거하니 문제가 싹 사라졌다..  
도대체 왜 이게 문제였던걸까?

# 근본 원인 정리
> org.springframework.orm.ObjectOptimisticLockingFailureException: Row was updated or deleted by another transaction

여기서 나는 단순히 **OptimisticLocking**이라는 단어에만 집중했다.  
하지만, 이 오류가 어떤 상황에서 나오는지를 제대로 파악하지 못했던 것이 실수였다.
- 동시성으로 인한 충돌이 발생했을 때
- JPA 엔티티의 영속성 상태가 꼬였을 때

이 두 가지 상황에서 나타나는 오류인데, 나의 경우는 후자였다.

## id 생성시점
IDENTITY 전략은 db 생성 시점에 id를 생성하는 전략이다.  
즉, 우리가 흔히 알고 있는 auto_increment가 이 전략인것이다.  

하지만, 나는 Domain 생성 시점에 Sequence를 이용해 수동으로 id를 부여하는 방식이다.  
바로, 여기서 문제가 발생한것이다.

## JPA의 save()
대부분 JPA의 `save()`를 호출하면 무조건 INSERT라고 생각한다.  
나도 그랬다. 수동으로 id를 생성했으니 자동으로 저장될 거라 착각했다.

하지만 JPA의 save()는 **엔티티가 새 것인지 기존 것인지 판단**한다:
```java
// SimpleJpaRepository.save() 내부
@Transactional
public  S save(S entity) {
  Assert.notNull(entity, "Entity must not be null");
  if (entityInformation.isNew(entity)) {
    em.persist(entity);  // INSERT
    return entity;
  } else {
    return em.merge(entity);  // SELECT + UPDATE
  }
}
```

**@GeneratedValue(IDENTITY)가 있으면:**
- id가 null → 새 엔티티
- id가 있음 → 기존 엔티티(detached) → **merge() 실행**

## merge()가 문제다

JPA의 save()는 내부적으로 엔티티가 새 것인지 판단하는데, **@GeneratedValue(IDENTITY)가 있을 때 id가 있으면 기존 엔티티로 간주하고 merge()를 실행**한다.  

merge()는 먼저 SELECT 쿼리로 DB에서 해당 id의 엔티티를 조회한다.  
만약 조회 결과가 있으면 변경사항을 UPDATE하고, 없으면 새 엔티티로 판단하여 INSERT를 시도한다.

내 경우를 보자. id가 16인 Payment 엔티티를 수동으로 생성했다.
```kotlin
val domain = Payment(id = 16, ...)
repository.save(domain)
```

JPA는 id가 이미 있으니 merge()를 실행한다. 그러면 다음과 같은 SQL이 날아간다.
```sql
SELECT * FROM payment WHERE id = 16;
```

하지만 이건 새로 만든 엔티티다. **DB에는 id=16인 row가 없다.**  
그럼 JPA는 INSERT를 시도해야 하는데, 문제는 이 엔티티가 detached 상태라는 점이다.   
새로 만든 객체인데 JPA는 이를 **영속성 컨텍스트에서 분리된 기존 엔티티**로 인식한다.

detached 상태의 엔티티는 version 정보가 꼬여있거나 없는 경우가 많다.  
JPA는 이 상태 불일치를 감지하고 OptimisticLockingFailureException을 던진다.

이 예외는 UPDATE의 affected rows = 0 때문이 아니다.  
엔티티의 영속성 상태와 DB 상태 불일치를 감지하여 발생시키는 예외다.

#### JPA의 4가지 상태

Transient (비영속) - new로 생성만 함  
Managed (영속) - 영속성 컨텍스트가 관리 중  
Detached (준영속) - 영속성 컨텍스트에서 분리됨  
Removed - 삭제 예정

# 결론
> 결국 이 오류는 동시성 충돌(Optimistic Conflict)가 아닌, 영속성 충돌(Persistence Conflict)였던것이다.  

@GeneratedValue(strategy = IDENTITY)는 JPA가 DB에게 id 생성을 위임하도록 만든다.  
하지만 도메인 계층에서 이미 id를 직접 생성하고 있었다.

즉, “DB도 id를 만들고, 애플리케이션도 id를 만든” 셈이다.  
JPA는 이 상태를 “이미 존재하는 엔티티”로 오인해 update를 시도했고, DB에는 해당 row가 없으니 “Row was updated or deleted by another transaction” 예외가 발생한 것이다.

@GeneratedValue를 제거해 식별자 책임을 도메인으로 일원화하자 문제는 즉시 사라졌다.

---

OptimisticLockingFailureException을 만나면 무조건 "동시성 문제"라고 단정 짓지 말자.  
JPA의 영속성 상태와 DB 상태의 불일치일 수도 있다.
