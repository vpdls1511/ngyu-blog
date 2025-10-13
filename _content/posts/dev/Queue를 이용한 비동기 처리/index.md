---
title: "ConcurrentLinkedQueue를 이용한 백그라운드 처리"
date: "2025-10-13"
excerpt: "ConcurrentLinkedQueue 를 이용한 비동기 처리"
coverImage: ""
---

> 회사에서 특정 데이터를 주기적으로 저장을 해야하는 요구사항이 생겼다.  
> 일 평균 1.5만건의 데이터를 저장해야했고, K8s를 이용한 분산 환경이라는 특징이 있어 이를 고려한 설계를 해야했다.

# 문제 상황
서비스를 유지보수하며 확인한게 있었다.  
특정 시간, 13시 - 15시까지 대부분의 요청이 몰리는 피크타임이고, 이 시간대에 하루 요청의 60%정도가 이 시간대에 몰려 TPS는 급격히 올라가게 된다.  

## 동기 처리의 한계
기존의 서비스는 `@Async`를 이용한 비동기 처리를 하고있었다. 

```java
@Async
public void execute() {
  // 데이터 처리 과정
}
```  

하지만 하나의 트랜잭션 단위로 보았을때 대부분의 흐름은 동기로 처리가 되고 있었다.    
만약, 이 데이터를 저장하는 서비스가 추가 될 경우, 수집/가공/외부 API호출/검증/저장 이 단계가 많게는 4-5초까지도 걸릴 수 있었다.  
피크타임에는 가용 스레드의 대부분이 점유되어 새로운 요청을 받을 수 없는.. 그런 스레드 고갈 현상이 발생될것 같아 방법을 고민했다.


## 고민, 그리고 Queue
### 5초라는 시간

> 5초라는 시간에 대해 처음에는 무의미하다고 느꼈다. 하지만, 스레드 관점으로 보면서 생각이 달라졌다.

피크타임에는 초당 약 50건의 요청이 발생하고 있었다.  
거기에 기존 시스템은 MSA 구조로 각 서비스가 평균 5-10초의 스레드 점유 시간을 가지고 있어 이를 단순 계산을 했을 때 아래와 같다.

t=1초 50개 스레드 점유  
t=2초 100개 스레드 점유  
t=3초 150개 스레드 점유  
t=4초 200개 스레드 점유  
t=5초 250개 스레드 점유

실제 점유율을 확인하기는 어려웠으나, 단순히 A서비스에서 B서비스로 요청을 보낸 사이 시간을 생각하며 단순 계산을 했을 때 스레드 점유율이 최대 250개까지 유지될 수 있다.  
여기서 새로 개발해야하는 특정 데이터를 저장하는 서비스가 평균 5초가 걸리면, 그만큼의 스레드가 더 필요해 스레드 고갈이 발생할 수 있다. 

### 새로운 스레드
이 때 생각해낸게 스레드를 지속적으로 점유하기보다, 1개의 스레드로 관리하는것이 어떨까 하는 생각이 들었다.  

### Queue
1개의 스레드로 관리를 하려 했으나 이 안에서도 비동기로 처리를 한다면 결국 스레드를 추가로 사용하는것밖에 안된다는 생각이 들었다.  
그래서 요구사항을 다시 검토해보니 **"데이터 중요도 낮음, 내부 확인용"** 이라는 내용에 따라 시간이 걸리더라도  
현재 규모에서는 데이터의 크기도 작아 처리 속도가 빠를것으로 예상되어 스레드를 1개로 제한해서 사용해도 괜찮겠다는 판단이 들었다.  

스레드 1개로 사용해도 되겠다는 생각에 FIFO 방식인 Queue의 자료구조가 바로 생각이 났다.

# 구현
이 기능 구현의 핵심은 `1개의 스레드에서 Queue를 이용한 순차적 데이터 저장`이다.
## LinkedList
처음에는 막연하게 LinkedList를 이용한 Queue의 구현을 생각했다.

```java
public class DataSaveService {
    private Queue<Task> queue = new LinkedList<>();
    
    public void saveQueue(final Task task) {
      queue.offer(task);
    }
}
```

지금 당장에 보기에는 문제가 없어보이지만, LinkedList의 동작 원리를 자세히 보니 문제의 여지가 보였다.  
LinkedList는

```java
private void linkLast(E e) {
    final Node<E> l = last;      // 1. 현재 마지막 노드 읽기
    final Node<E> newNode = new Node<>(e);  // 2. 새 노드 생성
    last = newNode;              // 3. last를 새 노드로 변경 ← 여기서 덮어씀!
    if (l == null)
        first = newNode;
    else
        l.next = newNode;        // 4. 이전 노드와 연결
    size++;
}
```

이러한 구조를 가지고 있다. 그렇다보니 동시에 n개의 스레드에서 접근을 할 경우 마지막 노드의 값이 n-1개의 요청은 사라지고 마지막에 실행한 스레드의 값으로 덮어씌워져 버린다.
> 아니 왜 덮어씌워지냐?  

라고 생각할 수 있는데, 저기 `last`는 인스턴스 변수로 선언이 되어 
하나의 LinkedList 객체를 공유하는 모든 스레드가 동일한 `last` 변수를 공유 하고 있기 때문이다.

```java
public class LinkedList<E>
  extends AbstractSequentialList<E>
  implements List<E>, Deque<E>, Cloneable, java.io.Serializable
{
  transient Node<E> last;
  
  // ...
  
  private void linkLast(E e) {
    // ...
    last = newNode;
    // ...
  }
}
```

### 다른 방법 : synchronized
여기서 결국 RaceCondition이 발생하기 때문에 동기적으로 저장하지 않으면 안되겠다는 생각이 들어 일전에 토스문서에서 읽고 개념만 알고있던 synchronized를 적용해보기로 했다.

```java
public class DataSaveService {
    private Queue<Task> queue = new LinkedList<>();
    
    public synchronized void saveQueue(final Task task) {
      queue.offer(task);
    }
}
```

이는 Thread-safe 하기 때문에 안전한 방법이며 구현도 간단했다.  
반대로, 한 번에 1개 스레드만 접근할 수 있어 안전하지만, 나머지 스레드들은 Lock을 획득하기 위해 대기해야 한다.

## ConcurrentLinkedQueue
Lock-free 하면서도 Thread-safe한 Queue가 어디 없을까 고민을 했다.  
그렇게 알게된게 CAS(Compare And Swap) 알고리즘이었고, 이를 직접 구현해야하나 고민을 하던 차에 `ConcurrentLinkedQueue`를 발견했다.

이는 CAS를 이용한 Lock-Free Queue로, 내가 원하는 기능을 딱 만들 수 있었다.

### CAS
> 잠깐, CAS에 대해서 간략하게나마 정리를 하고 넘어가보도록 해야겠다.  

아래 코드는 `ConcurrentLinkedQueue`의 CAS에 대한 원리를 간략하게 정리한 코드이다.

```java
public boolean offer(E e) {
    Node<E> newNode = new Node<>(e);
    
    // 성공할 때까지 무한 재시도
    for (;;) {
        Node<E> t = tail;  // 1. 현재 tail 읽기
        Node<E> p = t;
        
        // 2. tail의 next 찾기
        Node<E> q = p.next;
        
        if (q == null) {
            // 3. CAS로 추가 시도
            if (p.casNext(null, newNode)) {  // ← CAS!
                // 성공!
                if (p != t) {
                    casTail(t, newNode);  // tail 업데이트
                }
                return true;
            }
            // 실패하면 for 루프로 재시도
        } else {
            // tail이 뒤쳐져 있으면 업데이트
            casTail(t, q);
        }
    }
}
```

CAS는 **원자단위로 연산**되며, 3단계의 핵심 원리가 있다.  
**읽기 → 비교 → 교체**

이 과정에서 실패를 하게 되면 다시 읽기부터 재시도하는 과정을 거친다.  
너무 많은 실패를 하게되면 재시도 과정에서의 오버헤드가 많이 발생하겠지만, 현재 트래픽 수준에서는 감당 가능한 오버헤드라 보여 CAS를 적용한 `ConcurrentLinkedQueue`를 적용하기로 하였다.

## 최종 구현

위 개념들이 정리된것을 바탕으로,  
저장 → ( Queue소비 + DB 저장)  
로직을 구현하였다.

완성된 코드는 아래와 같다.

```java
@Slf4j
public class DataSaveService {
  private Queue<Task> queue = new ConcurrentLinkedQueue<>(); // ConcurrentLinkedQueue로 수정 
  private final AtomicBoolean isProcessing = new AtomicBoolean(false); // 중복 실행 방지를 위한 flag

  public void asyncProcess(final Task task) {
      queue.offer(task); // save
      log.info("데이터 DB 저장 시작");
      
      this.startProcessingIfIdle();
    }

  // 처리 시작
  private void startProcessingIfIdle() {
    // 중복 실행 방지
    if (!isProcessing.compareAndSet(false, true)) {
      return;
    }

    // 백그라운드에서 처리
    CompletableFuture.runAsync(this::drainQueue);
  }

  // Queue 비우기
  private void drainQueue() {
    try {
      Task task;
      int processedCount = 0;

      // Queue가 빌 때까지 순차 처리
      while ((task = queue.poll()) != null) {
        processTask(task);
        processedCount++;
      }

      if (processedCount > 0) {
        log.info("Queue 처리 완료 - 처리건수: {}건", processedCount);
      }

    } finally {
      isProcessing.set(false);

      // 처리 중 새 작업이 들어왔다면 재시작
      if (!queue.isEmpty()) {
        startProcessingIfIdle();
      }
    }
  }
}
```

# 정리
이렇게 개발을 하고 1주일정도 테스트를 하니 최대 Queue가 20건까지 쌓이는것을 볼 수 있었고, 모든 처리는 문제없이 잘 되고있었다.  
실제 운영을 돌리고나니 해봤자 20개라 생각했지만, 그래도 자원 생성/해제의 과정을 최대 20번이나 줄일 수 있다는 생각이 들었다.

이 코드와 구조가 정답은 아닐것이다. 다만, 현재 내 생각에서 가장 최선의 방법을 찾아낸것이다.  
더 좋은 방법이 있을 것 같긴 하지만.. 지금 당장에는 이정도가 최선인 것 같다.

---

이 코드에는 포함되지 않았지만, 큐의 크기를 확인할 수 있는 메서드가 존재한다.  
추후에는 이를 활용해 큐의 사이즈를 주기적으로 모니터링하고, 일정 임계치를 초과할 경우 알림을 발생시키는 방식도 고려해볼 수 있다.

또한 현재는 로직이 단순해 재시도 방식도 간단하게 구성되어 있으나,  
향후 트래픽 증가나 비동기 처리 로직이 복잡해질 경우에는 소비 스레드를 확장하거나 큐 풀을 분리하는 구조,  
나아가 Redis 기반 큐(예: Redis Stream, List 등)로의 확장 방향도 검토해볼 수 있을 것이다.

