---
title: "전략패턴에 when말이냐!"
date: "2025-10-19"
excerpt: "OCP원칙을 해치는 전략패턴, 이를 어떻게 개선했을까"
coverImage: ""
---


> 나는 지금 개인적인 공부를 위해 SwiftPay라는 Koltin+SpringBoot기반 토이프로젝트를 진행하고 있다.  
> 이러던 중, 1개의 결제건에 대해 N개의 결제수단이 나올 수 있고,  
> 공통적으로 사용할 수 있는부분과 없는부분이 나뉘어진다 생각해 이를 추상화하여 개발을 했다.

# 현재 구조
실제 구현과는 조금 다르게 작성을 했으나, 구조는 아래와 같았다. 지금 당장 내 머리에서 나오는 방식은 이 방식 한 가지 였다.  
하지만.. 코틀린의 장점, 아니. 스프링의 장점을 더 살려보기로 했다.

```kotlin
// PaymentStrategy.kt
interface PaymentStrategy {
  fun getPaymentMethod(): PaymentMethod
  fun shouldAsyncProcessing(payment: Payment): Boolean
  suspend fun process(payment: Payment): PaymentResponseDto
  fun getStrategyName(): String
}
```

```kotlin
// PaymentStrategyFactory.kt
class PaymentStrategyFactory {
  // ....
  fun getStrategy(payment: Payment): PaymentStrategy {
    return when (payment.method) {
      PaymentMethod.CARD -> CardPaymentStrategy()
      PaymentMethod.BANK_TRANSFER -> BankPaymentStrategy()
      else -> throw UnsupportedOperationException("지원하지 않는 결제수단 입니다.")
    }
  }
}
```

```kotlin
// CardPaymentStrategy.kt
class CardPaymentStrategy: PaymentStrategy {
  override fun getPaymentMethod() = PaymentMethod.CARD
  override fun shouldAsyncProcessing(payment: Payment) = true
  override suspend fun process(payment: Payment) = null
  override fun getStrategyName() = "카드결제"
}
```

```kotlin
// BankPaymentStrategy.kt
class BankPaymentStrategy: PaymentStrategy {
  override fun getPaymentMethod() = PaymentMethod.BANK_TRANSFER
  override fun shouldAsyncProcessing(payment: Payment) = true
  override suspend fun process(payment: Payment) = null
  override fun getStrategyName() = "계좌이체"
}
```

## 개선
기존 방식의 문제는 명확했다. 바로, 결제 수단이 추가될때마다 when을 수정해줘야한다는.. 번거로움이 있기 때문이다.  

```kotlin
enum class PaymentMethod {
  CARD,
  BANK_TRANSFER,
  EASY_PAY, // 이게 추가된다면
}
```

이 상황에서 `EASY_PAY`가 추가된다고 가정해보자. 그러면 **아래 파일이 함께 추가/수정 되어야 할 것이다.**
- PaymentStrategyFactory.kt
- EasyPayStrategy.kt

PaymentStrategyFactory.kt는 when조건이 추가되게 된다. 이는 **SOLID 원칙 중 OCP를 위반하는 코드**이기도 하다.

## Spring의 Bean 자동 주입 활용
그렇다면 어떻게 해야할까 고민을 많이 하던 중 생각난것이 Spring의 Bean자동 주입 활용이다.  
Spring은 같은 타입의 Bean이 여러 개 있을 때, **List나 Map으로 한 번에 주입**할 수 있다

### Spring의 동작 과정
잠깐, 이를 이해하기 위하여 동작 과정을 짧게나마 확인해보자.

#### Component Scan
Spring은 애필리케이션을 시작 할 때 Component Scan 단계를 거친다. 이 과정에서 아래와 같은 일이 벌어진다.  
- 음.. PaymentStrategy가 있네.. 이를 상속받는 @Compoennt를 찾아볼까?
- CardPaymentStrategy가 있구나 이걸 Bean으로 등록하자..
- BankPaymentStrategy 있구나 이걸 Bean으로 등록하자..

####  의존성 주입
> Component Scan을 통해 등록된 이 Bean들을 list혹은 map으로 원하는곳이 있다면 이를 묶어 타입에 맞게 주입을 해 준다.

## 자동 매핑 구현
잠깐 알아본 동작과정은 나에게 큰 힌트가 되었다.  
스프링은 **애플리케이션이 실행하는 도중에 딱 1번 bean을 list 혹은 map 만들어주기 원한다면 이를 list 로 주입해준다**는 중요한 사실을 알았다  
이를 사용해서 Factory에 적용하면 좋겠다는 생각을 했다.

```kotlin
// 개선 : PaymentStrategyFactory.kt
class PaymentStrategyFactory(strategies: list<PaymentStrategy>) {

  private val strategiesMap = strategies.associateBy { it.getPaymentMethod() }
  
  fun getStrategy(payment: Payment): PaymentStrategy = strategiesMap[payment.method]
    ?: throw UnsupportedOperationException("지원하지 않는 결제수단 입니다.")
}
```

아주 간결해졌다.  
간결해졌을 뿐 아니라, OCP의 원칙도 잘 지켰다.

### 코드 설명
1. List<PaymentStrategy> 주입  
Spring은 `PaymentStrategy` 타입의 모든 Bean을 찾아 **List로 묶어서 주입**한다  

```kotlin
class PaymentStrategyFactory(strategies: list<PaymentStrategy>)
```

2. associateBy를 통한 Map 생성   
associateBy는 내부적으로 LinkedHashMap을 사용하여 List를 Map으로 변환해주는 Kotlin만의 표준 함수다!~~Koltin 완전 편하다 !~~  
PaymentStrategy를 상속받는 각 메서드를 보면 하나같이 getPaymentMethod()를 필수로 리턴해주게 설계 해 두었다.  
**그렇다보니 각각의 메서드들은 본인 전략에 맞는 PaymentMethod를 리턴해주고, 이를 Key값으로 strategiesMap에 PaymentStrategy를 저장하는것이다.**

```kotlin
private val strategiesMap = strategies.associateBy { it.getPaymentMethod() }
```

3. O(1) Map 조회
[]를 통해 키를 검색하는것은 HashMap lookup으로, 이는 **상수 시간에 동작**한다.  
기존 when, if-else 방식과 성능 차이는 미미하지만, **개념적으로는 더 효율적**인 방식이다.
```kotlin
strategiesMap[payment.method]
    ?: throw UnsupportedOperationException("지원하지 않는 결제수단 입니다.")
```

# After
기존에는 `PaymentStrategyFactory.kt`, `EasyPayStrategy.kt`이렇게 두 개의 파일을 수정/생성하며 OCP 원칙을 어겼으나,  
개선 후에는 `EasyPayStrategy.kt`만 생성하면 자동으로 전략이 추가된다.

# 마치며
처음에는 막연히 PaymentMethod에 따라 분기처리를 해주면 끝이겠거니 하며 Factory를 작성했다.  
하지만, 조금 더 생각해보니 결제수단은 카드와 은행 이 두 가지가 끝이 아니다.  
토스를 보면 지금은 새로운 페이 방식인 "얼굴 결제"까지도 나온 상황이다. 그렇기에 결제수단에 대한 확장은 늘어날 수 있는데 이렇게 추가가 생길 때 마다 Factory를 수정해야 한다면.. 이는 얼마나 비효율적인가에 대한 생각을 시작으로 개선의 필요성을 느끼게 되었다.  

이런 **사소한 생각**이 시작이 되고, **SOLID 원칙**만 잘 지켜도 **"확정성을 고려한 설계"**를 할 수 있다는 사실을 알게 되었다.  
또, **개발을 할 때 프레임워크의 특성까지도 최대한 활요할 수 있어야 한다**는 점에서 아직 부족하다는 생각을 했다.
