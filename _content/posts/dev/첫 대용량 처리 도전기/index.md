---
title: "첫 대용량 처리 도전기"
date: "2025-08-17"
excerpt: "동기에서 병렬로! 2년차의 첫 대용량 처리 도전기"
coverImage: ""
---

>처음으로 맡게된 프로젝트가 하나 있다.바로, 스케줄러를 이용하여 매일 2달이지난 파일을 삭제하는것이다.
>
>**매일 약 1만개의 파일이 생성되었으며, 이 파일들이 하루이틀 지나며 1G, 2G.. nTB 까지 축적**되어있었다.
이미 기존에 구현되어있는 시스템이 있었으나, **효율이 좋지않아 기존 구현된 서비스를 교체하기 위하여 새로 만드는것**이었다.

# 파일을 어떻게 관리를 하고있었을까

생성된 파일의 경로는 DB에, 파일 원본은 사내 NAS서버에 저장되고 있었다.
기존에는 파일의 경로를 `/nas/20250101/file` 이같은 형태로 저장하고, 삭제되면 `deleted` 상태로 변환되고 있었다.
이 외에도 파일의 정보가 DB에만 저장되어있는것을 보니 DB에 직접 파일을 저장하는것은 굉장히 비효율적이라 메타데이터정도만 DB에 저장하는것으로 확인되었다.
그리고 NAS에 직접 접근하여 확인해보면 하위 파일들이 없을경우, 상위 폴더까지 삭제를 해주고 있던것으로 확인되었다.

# 기존 로직 파악

기존 로직을 파악하던 중, FileUtil 을 따로 만들어 사용중이었고, 이는 common 모듈에서 가져오는 방식이었다.
FileUtil 에서는 deleteDirectory() 라는 메서드를 사용하여 파일을 삭제하고있는것으로 파악되었다.

```java
public class FileUtil {
	public void deleteDirectory(File file) {
		// ... 파일삭제 로직
	}
}
```

즉, 공통 모듈의 deleteDirectory() 메서드를 재사용하면 파일 삭제 기능을 별도로 구현할 필요가 없어보였다.

또한, 운영단에서는 info, error 정도의 로그만 기록되는데, 모든 로그가 trace 레벨로 잡혀있어 운영에 올라갔을 때 어디서 어떤 문제가 일어났는지 정확히 알기가 어려웠다.

## 기존 로직의 문제점

기존 로직의 문제점은 명확하였다. 오래된 시스템이다보니 파일이 적었을때만을 고려한것 같았다.
아래 예시코드와 같이 단순히 for를 이용한 동기처리뿐이었다.

또한, 실행시간을 모니터링할 수 없다는 단점도 존재하였다.

```java
public class FileScheduleService {
	public void deleteFileScheduler() {
		List<File> files = fileRepository.getAllTwoMonth();

		for (File file : files) {
			if(checkFile(file) {
				FileUtil.deleteDirectory(file)
			}
			// 이후 예외처리
		}
	}
}
```

## 개선점

1. **동기식이다 보니 총 작업시간이 오래걸린다.**
2. 로그를 가볍지만 상세하게 적어둘 필요가 있어보인다.
3. **실행 시간에대한 모니터링이 필요하다.**

이것들을 보고 이렇게 생각했다.

> "멀티스레딩을 이용하여 병렬처리로 변경하고, 로그를 조금 더 상세하게 남길 수 있도록 해보자"

# 멀티스레딩 도입기

멀티스레딩을 도입하려는 순간, Thread를 직접 생성하여 사용하는 방법과 ExecutorService를 이용해 스레드풀을 관리하는 방법 중 선택을 하는데 있어 많은 고민이 있었다.

### Thread

>**Thread를 직접 구현하는 방식은 새로운 작업마다 새로운 스레드를 생성한다.**

이 경우 수백, 수천 개의 파일을 동시에 삭제하게 되면 스레드의 개수가 폭발적으로 늘어나며, 이는 곧 운영 서버의 메모리와 CPU를 소진시켜 서비스 장애로 이어질 수 있다.
설령 서버가 다운되지 않는다 하더라도, 스레드가 많아질수록 컨텍스트 스위칭 비용이 커져 전체 시스템에 불필요한 부하를 주게 된다.

### ExecutorService

>**ExecutorService는 필요한 만큼의 스레드 풀을 미리 생성해두고 이를 재사용하기 때문에, 불필요한 스레드 생성을 방지하고 운영 서버의 부하를 안정적으로 제어할 수 있다.**

풀 크기를 통해 동시에 실행 가능한 스레드 수를 제한할 수 있어, 대량 작업을 수행할 때도 서버 자원을 효율적으로 관리할 수 있다.
더 나아가 Future와 Callable을 활용하면 각 작업의 성공/실패 여부를 손쉽게 추적할 수 있고, 모든 스케줄링이 종료된 후에는 shutdown() 같은 메서드로 리소스를 안전하게 해제할 수 있다.

## 구현

간단하게 1-2개의 Job 의 경우 thread를 직접 구현하는것도 좋겠지만, 여러 운영환경에서 파일을 삭제해야하는 이유로 ExecutorService 를 이용하여 멀티스레딩 병렬처리를 구현하기로 하였다.
처음에는 막연히 max pool size 를 10으로 잡아두고 햇었다.

```java
public class FileScheduleService {
	private final int MAX_THREAD_POOL_SIZE = 10;

	public void execute() {
		log.info("FileScheduleService - Start");
		ExecutorService executorService = Executors.newFixedThreadPool(MAX_THREAD_POOL_SIZE);

		...

		log.info("FileScheduleService - end");
	}
}
```

그런데, 갑작스러운 고민이 생겼다.

> 스레드는 서버의 성능에 따라 다를텐데, 10으로 잡는게 맞을까?

우리 서비스는 MSA로 구성이 되어있고, 기존 배치 서버는 스케일아웃되어 분산환경 위에서 작동되고있었다. 각 서버마다의 성능이 조금씩은 다를텐데 pool을 10으로 고정하는게 맞을까 하는 생각이 들었다.

### Runtime.getRuntime().availableProcessors()

> Runtime.getRuntime().availableProcessors() 메소드는 JVM이 실행되고있는 시스템의 cpu 코어 개수를 알 수 있다.

파일 삭제같은 경우 cpu를 통한 연산보다 디스크 I/O에 의한 대기시간이 꽤 크다. 그래서 단순히 cpu 코어 수 만큼 thread를 할당해준다면, 오히려 cpu 가 쉬는 시간이 늘어나게 되어 이처럼 I/O bound 작업에서는 cpu 의 코어 수 보다 더 많은 스레드를 두어 자원을 효율적으로 활용하는것이 좋다.

availableProcessors()를 이용하면 JVM이 실행되고있는 시스템의 코어수를 알 수 있다. 개발서버에서 확인해보니 1이 나왔는데, 이는 I/O bound 작업이 많은 경우 단순히 이 수 만큼 스레드를 두면 부족할 수 있다는것을 의미한다. 운영서버에서도 확인을 하고 싶었으나, 이거는 리스크가 좀 있어보여 단순히 4코어라 가정 후 스레드 풀의 크기를 2배, 3배 등으로 단순 계산을 해 보니 CPU 코어 수의 2배정도로 스레드를 설정하는것이 가장 합리적이라는 결론을 얻었다.

다만, 실제 운영하는 환경에서는 24, 36처럼 클 경우도 있다. 그렇기에 당장에 최대 10개정도 까지는 무리없이 동작하는것으로 확인되어 추후에 증가 시키더라도 availableProcessors() * 2 의 값과 기존 최대값 중 더 작은 값을 적용하도록 구현하였다.

```java
public class FileScheduleService {
	private final int MAX_THREAD_POOL_SIZE = 10;

	public void execute() {
		int threadPoolSize = Math.min(Runtime.getRuntime().availableProcessors() * 2, MAX_THREAD_POOL_SIZE);
		ExecutorService executorService = Executors.newFixedThreadPool(threadPoolSize);
		log.info("FileScheduleService thread : {}", threadPoolSize);
	}
}
```

## 삭제

이제 파일을 병렬로 삭제하는 `processFileInParallel` 이라는 메서드를 만들었다.
이 안에서 CompletableFuture를 이용하여 파일삭제를 병렬로 처리할 수 있게 했다.

```java
public ArrayList<Long> processFileInParallel (
	final List<File> fileList,
	final ExecutorService executorService
) {
	List<CompletableFuture<Long>> future = fileList.stream()
		.filter(file -> file.getType().contains(FILE_SYSTEM))
		.map(file -> CompletableFuture.supplyAsync(() -> {
			// 파일삭제 로직
		}, executorService))
		.collect(Collectors.toList());

	return future.stream().map(it -> {
		//삭제된 파일 id 가져오기	
	})
	.filter(Objects::nonNull)
	.collect(Collectors.toCollection(ArrayList::new));
}
```

여기서 리턴된 Long 타입의 id 값들을 jpa 를 통하여 상태를 업데이트 시켜주었다.

## 리소스 해제

사실, 멀티스레딩을 이용한 병렬처리를 모두 끝낸 다음에는 리소스를 정확하게 해제해주어야 한다. 그렇지 않으면 GC가 해제해주지 않는 이상 스레드 풀은 계속 메모리에 남아있게된다.

```java
executorService.shutdown();
```

이를 사용하면 되지만, 종종 이를 사용하여도 shutdown 중 TIMED_OUT 이 생기거나  InterruptedException이 생길 수 있다.
그렇기 때문에 이런식으로 리소스 해제를 시켜주었다.

```java
public abstract class SchedulerAbstract {

	protected void shutdownExecutorService() {
		executorService.shutdown();
		try {
			if(!executorService.awaitTermination(SHUTDOWN_TIMEOUT, TimeUnit.SECONDS) {
				log.error("ExecutorService TimeOut")
				executorService.shutdownNow();
			}
		} catch (InterruptedException e) {
			log.error("ExecutorService InterruptedException")
			executorService.shutdownNow();
			Thread.currentThread().interrupt();
		}
	}
}
```

## 실행시간 모니터링

실행 시간에 대한 모니터링이 존재하지 않아 얼마나 걸렸고, 언제 끝난것인지 파악하기 굉장히 어려웠다.
그래서 간단하게나마 execute하는 시점에 로그를 기록해두기로 했다.

```java
public void cleanupOldFaxFiles() {
        LocalDateTime startTime = LocalDateTime.now();
        log.info("팩스 파일 정리 작업 시작 = {} ", startTime);

        try {
            removeFaxFileService.execute();
            log.info("팩스 파일 정리 작업 성공적으로 완료 - 소요시간: {}ms", Duration.between(startTime, LocalDateTime.now()).toMillis());
        }catch (Exception e){
            log.error("팩스 파일 정리 작업 실패 - 시작시간: {}", startTime, e);
        }
    }

```

### 성능비교

기존 시스템에서 어느정도 시간으로 삭제되고있는지 정확히 확인해볼 수 없었다.
단순 사칙연산으로만 계산을 해보고자 한다.

**개발서버에서 스레드풀 2개로** 잡고, 1만개의 파일을 지우는데 **10분내외**가 소요되었다.
이 결과만 놓고 보앗을 때 **기존 동기적인 방식으로 삭제했을경우 오버헤드등을 고려하였을 때 약 25분정도 소요될것으로 예상**된다.
**개발서버 기준으로 2.5배정도의 성능 향상**이 일어났을것으로 보인다.

**운영서버에서 4-8 정도의 스레드풀 이라면** 1-2분 내외일것으로 예상된다.
이렇게 본다면 **성능 향상은 약 5-10배정도 된다고 추정**해볼 수 잇을것같다.
# 결론

아직은 조금 조심스러워 해당 글에 많은것을 적지 못하였다.
해당 스케줄러에서 DB의 부하를 최소화 하기 위해 한번에 많은 데이터를 가져오기보다 분할해서 가져와 이 풀이 다 해소될대까지 while을 돌리는 과정과, 이 while의 조건을 설정하는 등을 ScheduleContext 객체를 만들어 관리하였는데, 이와 관련된 내용은 포함하지 않았다. ( 뭔가 문제될 수 있을거같아서 .. ) 이 외에도 많은 고민을 통해 해당 시스템을 구현하였다.

개발서버에 올라간지 2주정도 지났고 테스트결과 문제 없어 조만간 배포될것으로 예상되는데, 이 서비스를 구현하며 이런 생각이 들었다.

단순히 스레드를 많이 돌리는것이 능사가 아니라 **서버 환경과 작업 환경에 맞춰 풀 크기를 설계하고, 안전하게 리소스를 해제하는것이 중요하다**는 사실을 깨닫게 되었다.
나에게 있어 처음으로 대용량 작업(주니어는 이정도도 크다..)을 설계하는 일을 맡았는데, 앞으로는 이번 경험을 바탕으로 더 나은 안정성과 확장성을 함께 고려해야겠다.
