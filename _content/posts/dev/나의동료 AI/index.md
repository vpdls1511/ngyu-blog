---
title: "나의동료, AI"
date: "2026-02-23"
excerpt: "AI에게 시킨 게 아니라, AI와 같이 한 리팩토링."
coverImage: ""
---

> 1,000줄짜리 God Method를 리팩토링해야 했다.  
> Map 기반 데이터 전달, 연동사 추가마다 5개 파일 수정, 순환 참조로 빌드 실패.  
> 혼자 분석하면 반나절, 수정하면 하루가 걸리는 구조였다.  
> 이 과정에서 AI를 코드 생성기가 아니라 **구조 분석과 설계 검증을 같이하는 동료**로 써봤다.
> *이 글은 AI를 "어떻게 시켰는가"가 아니라 "어떤 판단을 내가 했고, 뭘 AI에게 맡겼는가"에 대한 기록이며, 실제 코드를 그대로 리스크가 있어 AI를 통한 예제로 작성되었다.*

# 왜 AI를 썼나

리팩토링 자체가 목적이 아니었다.  
운영 중인 서비스의 레거시 코드를 **무중단으로 점진 개선**해야 했다.

문제는 코드 분석에 드는 시간이었다.  
1,000줄 메서드 하나 읽는 데 반나절, 수정 영향 범위 파악에 또 반나절.  
실제 코드를 고치는 시간보다 **읽는 시간이 더 긴** 구조였다.

AI를 쓰기로 한 이유는 단순했다.  
**반복적인 구조 분석과 보일러플레이트 생성은 AI가 빠르고, 설계 판단은 내가 해야 하니까.**

# 구조 분석

## 문제

핵심 처리 메서드가 약 1,000줄이었다.  
데이터 수집, 변환, 가공, 전송이 전부 한 메서드에 있었다.

```java
public class ExternalProcessService {

    public Map<String, Object> process(String vendorCode, Map<String, Object> data) {
        // 1. 데이터 수집 (약 200줄)
        Map<String, Object> collected = new HashMap<>();
        collected.put("clientName", data.get("name"));
        collected.put("itemCode", data.get("code"));
        collected.put("orgInfo", getOrgInfo((String) data.get("orgCode")));
        // ... 수십 개의 put과 get

        // 2. 연동사별 변환 (약 300줄)
        Map<String, Object> transformed = new HashMap<>();
        if ("VENDOR_A".equals(vendorCode)) {
            transformed.put("a_client_nm", collected.get("clientName"));
            transformed.put("a_item_cd", collected.get("itemCode"));
            // ... A사 전용 변환 수십 줄
        } else if ("VENDOR_B".equals(vendorCode)) {
            transformed.put("b_nm", collected.get("clientName"));
            // ... B사 전용 변환 수십 줄
        }

        // 3. 가공 (약 200줄)
        // 4. 전송 (약 300줄)
        return transformed;
    }
}
```

이걸 직접 읽으면서 "어디서 어디까지가 수집이고, 어디서부터 변환인지" 파악하는 데만 시간이 걸렸다.

## AI에게 맡긴 것: 책임 분류

AI에게 코드를 넘기고 이렇게 요청했다.

> "이 메서드의 책임을 단계별로 분류하고, 각 단계에서 사용하는 외부 의존성과 데이터 흐름을 정리해줘."

돌아온 결과:

```
1단계 - 데이터 수집
  - 외부 의존: OrgRepository, ClientRepository
  - 입력: Map<String, Object> (raw data)
  - 출력: Map<String, Object> (collected data)
  - 문제: 키 이름이 하드코딩, 타입 캐스팅 다수

2단계 - 연동사별 변환
  - 외부 의존: 없음 (순수 변환)
  - 입력: collected Map
  - 출력: transformed Map
  - 문제: if-else 분기 4개, 연동사 추가 시 분기 추가 필수

3단계 - 데이터 가공
  - 외부 의존: ValidationService
  - 문제: 수집 단계의 키를 직접 참조, 2단계와 암묵적 결합

4단계 - 전송
  - 외부 의존: FaxSender, FileSender, ApiSender
  - 문제: 전송 방식도 if-else로 분기
```

**10분 만에 나왔다.** 내가 직접 했으면 반나절이었다.

## 내가 판단한 것

AI의 분석을 보고 두 가지를 결정했다.

1. **각 단계의 입출력이 명확하다** → 단계별 클래스 분리가 가능하다
2. **2단계(변환)와 4단계(전송)의 if-else가 핵심 문제다** → 여기를 전략 패턴으로 전환해야 한다

구조를 빠르게 시각화한 건 AI였고, **어떤 순서로 분리할지는 내가 정했다.**

---

# 설계 방향 토론

## 문제

Factory 패턴이 이미 있었지만, 실질적으로는 분기문 래퍼였다.

```java
public class ProcessorFactory {

    public Map<String, Object> process(String vendorCode, Map<String, Object> data) {
        if ("VENDOR_A".equals(vendorCode)) {
            return processVendorA(data);
        } else if ("VENDOR_B".equals(vendorCode)) {
            return processVendorB(data);
        } else if ("VENDOR_C".equals(vendorCode)) {
            return processVendorC(data);
        }
        throw new IllegalArgumentException("Unknown: " + vendorCode);
    }

    private Map<String, Object> processVendorA(Map<String, Object> data) {
        // 변환 + 가공 + 전송이 한 메서드에 혼재
        Map<String, Object> result = new HashMap<>();
        result.put("a_client_nm", data.get("clientName"));
        // ... A사 전용 로직 수백 줄
        sendFax(result); // 전송까지 여기서!
        return result;
    }
}
```

**Factory라는 이름만 있고, 실제로는 if-else 덩어리.**  
연동사 추가하면 여기에 else-if 하나 더 추가해야 했다.

## AI에게 맡긴 것: 설계 대안 비교

전략 패턴으로 가기로 했는데, 인터페이스를 어떤 단위로 나눌지 고민이었다.

> "변환과 전송을 하나의 인터페이스로 묶는 방식(안 A)과, 별도 인터페이스로 분리하는 방식(안 B)의 트레이드오프를 비교해줘."

AI가 정리해준 비교:

- **안 A (단일 인터페이스)**: 구현 단순, 연동사 추가 시 구현체 1개, 대신 전송 방식만 바꿀 때도 구현체 전체 수정
- **안 B (분리 인터페이스)**: 전송 변경에 유연, 대신 연동사 추가 시 구현체 2개 필요, 현재 규모에서는 과설계 가능성

## 내가 판단한 것

현재 연동사 4개, 향후 3~4개 추가 예정.  
이 규모에서 안 B는 과설계였다.

**안 A를 선택하되, 전송 방식 변경이 빈번해지면 그때 분리하기로 결정했다.**

AI는 각 안의 구조적 차이를 정리해줬고, **규모와 변경 빈도를 기준으로 최종 선택은 내가 했다.**

---

# 구현

## Map → DTO 전환

기존 코드의 가장 큰 문제 중 하나가 Map 기반 데이터 전달이었다.

```java
// 어떤 키가 있는지, 타입이 뭔지 알 수 없다
Map<String, Object> data = new HashMap<>();
data.put("clientName", "홍길동");
data.put("itemCode", "A001");
data.put("amount", 50000);
data.put("orgCode", "ORG_001");
// 이 Map이 메서드를 3~4개 거치면서 키가 추가/변경됨
// 최종적으로 어떤 키가 있는지 아무도 모름
```

Map에서 사용하는 키를 전부 추출해서 DTO 필드로 매핑해야 했다.  
이건 판단이 필요한 작업이 아니라 **정확한 반복 작업**이다.

AI에게 맡겼다.

> "이 메서드에서 Map에 put하는 모든 키를 추출해서, 적절한 타입의 필드를 가진 DTO 클래스로 만들어줘."

```java
// AI가 생성한 DTO
@Getter
@Builder
public class ProcessData {
    private final String clientName;
    private final String itemCode;
    private final Long amount;
    private final String orgCode;
    private final OrgInfo orgInfo;
}
```

**컴파일 시점에 타입과 필드가 보장된다.**  
`data.get("ammount")` 같은 오타는 이제 컴파일 에러로 잡힌다.

다만 AI가 생성한 DTO를 그대로 쓰진 않았다.

- 기존 Map에서 **실제로 사용되는 키만** 포함되었는지 확인
- 불필요하게 추출된 중간 단계 키 제거
- `null` 허용 필드와 `@NonNull` 필드 구분

**DTO 7개를 AI가 초안을 잡고, 내가 필드 정제와 검증을 수행했다.**  
수작업 대비 약 70% 시간 절감.

## 전략 패턴 구현체 생성

인터페이스는 내가 설계했다.

```java
public interface VendorStrategy {

    boolean supports(String vendorCode);

    ProcessRequest transform(ProcessData data);

    ProcessResponse send(ProcessRequest request);
}
```

연동사별 구현체의 초안 생성은 AI에게 맡겼다.

```java
@Component
public class VendorAStrategy implements VendorStrategy {

    @Override
    public boolean supports(String vendorCode) {
        return "VENDOR_A".equals(vendorCode);
    }

    @Override
    public ProcessRequest transform(ProcessData data) {
        return ProcessRequest.builder()
                .clientName(data.getClientName())
                .itemCode(data.getItemCode())
                .amount(data.getAmount())
                .build();
    }

    @Override
    public ProcessResponse send(ProcessRequest request) {
        return vendorAClient.submit(request);
    }
}
```

**AI가 한 것:** 인터페이스 구현 보일러플레이트, 필드 매핑  
**내가 한 것:** 연동사별 비즈니스 규칙, 예외 케이스, 에러 핸들링

구현체 4개를 이 방식으로 만들었다.  
구현체당 반나절 걸리던 작업이 **AI 골격 + 내 보완으로 구현체당 2시간**이면 끝났다.

---

# 코드 리뷰

리팩토링이 끝난 코드를 AI에게 리뷰 요청했다.  
특히 **내가 놓칠 수 있는 구조적 문제**를 잡아달라고 했다.

> "이 전략 패턴 구조에서 연동사가 10개로 늘어났을 때 문제가 될 수 있는 부분을 지적해줘."

## AI가 지적한 것

**1. StrategyResolver의 선형 탐색**

```java
// 현재: List를 순회하며 supports() 호출 → O(n)
// Map<String, VendorStrategy>으로 전환하면 O(1)
```

**2. supports() 중복 위험**

두 구현체가 동일한 vendorCode를 supports()할 경우 첫 번째 구현체만 실행된다.  
방어 로직이 없으면 **버그인데 에러가 안 나는** 최악의 상황이 된다.

## 내가 판단한 것

1번은 보류했다.  
연동사 4개, 최대 8개 수준에서 O(n) vs O(1)은 유의미하지 않다.

2번은 실제로 발생 가능한 버그였다.  
애플리케이션 기동 시 중복을 검증하는 방어 로직을 추가했다.

```java
@Component
public class VendorStrategyResolver {

    private final List<VendorStrategy> strategies;

    public VendorStrategyResolver(List<VendorStrategy> strategies) {
        this.strategies = strategies;
        validateNoDuplicate();  // 기동 시 중복 검증
    }

    public VendorStrategy resolve(String vendorCode) {
        return strategies.stream()
                .filter(s -> s.supports(vendorCode))
                .findFirst()
                .orElseThrow(() -> new UnsupportedVendorException(vendorCode));
    }

    private void validateNoDuplicate() {
        // 같은 vendorCode를 처리하는 구현체가 2개 이상이면 즉시 실패
        // 런타임이 아니라 기동 시점에 잡는 게 핵심
    }
}
```

**기동 시 실패(Fail-Fast)가 런타임 실패보다 낫다.**

AI는 잠재적 문제를 빠르게 나열해줬고, **현재 규모에서 대응이 필요한 것과 아닌 것을 구분하는 건 내가 했다.**

---

# 시행착오

## AI가 생성한 DTO 필드 과잉

AI에게 "Map의 모든 키를 DTO로 만들어줘"라고 했더니, 중간 처리 과정에서만 쓰이는 임시 키까지 전부 필드로 만들었다.

```java
// AI가 만든 DTO
public class ProcessData {
    private final String clientName;
    private final String itemCode;
    private final String tempKey1;      // 중간 처리용, 외부 노출 불필요
    private final String debugFlag;     // 디버깅용, 운영에서 불필요
    // ...
}
```

**"전부 추출해줘"는 잘못된 프롬프트였다.**  
"외부로 전달되는 최종 필드만 추출해줘"로 바꿨더니 정확도가 올라갔다.

AI에게 맡기는 것도 요구사항 정의가 정확해야 한다는 걸 배웠다.

## 설계 대안을 AI 추천 그대로 따를 뻔 한 것

AI가 안 B(분리 인터페이스)를 "확장성 관점에서 더 나은 설계"라고 추천했다.  
처음엔 그대로 따르려 했다.

하지만 현재 연동사 4개에 분리 인터페이스는 과설계다.  
**AI는 "이론적으로 더 나은 설계"를 추천하지, "지금 이 규모에서 적정한 설계"를 추천하지 않는다.**

이후로는 AI에게 대안을 물을 때 반드시 **"현재 규모는 X이고, 향후 Y까지 늘어날 예정"**이라는 맥락을 같이 넘기기 시작했다.

---

# 결론

> "AI는 코드를 읽는 속도를 10배 빠르게 해줬지만,  
> 이 시스템에서 지금 가장 중요한 문제가 뭔지를 판단하는 건 여전히 사람의 몫이다."

**AI에게 맡긴 것 (반복·구조화 작업):**
- 1,000줄 메서드의 책임 분류, 의존성 맵 추출
- 인터페이스 분리 수준의 트레이드오프 정리
- Map 키 추출 → DTO 초안 생성
- 구현체 보일러플레이트 생성
- 확장 시 잠재적 문제 탐색

**내가 한 것 (판단·결정 작업):**
- 전면 재설계 대신 점진적 개선 방식 선택
- 분리 순서와 우선순위 결정
- 현재 규모에 맞는 적정 설계 수준 판단
- 연동사별 비즈니스 로직, 예외 케이스 처리
- AI 리뷰 지적 중 실제 대응 필요한 것 선별

**체감 결과:**
- 구조 분석: 반나절 → AI 분석 10분 + 내 검증 30분
- DTO 7개 생성: 수작업 하루 → AI 초안 + 검증 2시간
- 구현체 4개: 구현체당 반나절 → AI 골격 + 보완 구현체당 2시간
- 기능 수정 소요: 1~2일 → 5시간 이내
- 연동사 추가: 5개 파일 수정 → 구현체 1개 추가

AI를 "시키는 도구"로 쓰면 코드 생성기에 불과하다.  
**"같이 일하는 동료"로 쓰면 내가 판단에 집중할 수 있는 시간이 늘어난다.**

그게 이번 리팩토링에서 얻은 가장 큰 교훈이었다.
