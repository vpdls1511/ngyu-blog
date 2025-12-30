---
title: "try-with-resources"
date: "2025-12-29"
excerpt: "자원을 회수하기 위한 최적의 방법"
coverImage: ""
---
> **try-finally 문을 제대로 사용한 코드에서도 미묘한 결점이 있다. 예외는 try 블록과 finally 블록 모두에서 발생할 수 있는데,**  
> 출처 : Effective Java

# try-finally 방식의 문제점
try문 내부에서 자원을 회수하기 위해 try-finally 방식을 이용했지만, "finally" 에서도 "예외" 가 발생할 수 있기에, 최선의 방법이 아니다.   
그렇다면 어떻게 해야 정확하게 자원을 회수할 수 있을까?

위와 같은 문제는 Java7에서 "try-with-resources" 덕에 현재 우리가 편하게 작업을 할 수 있게 되었다.

## try-finally
```java
static String readFirstLine(String path) throws IOException {
    BufferedReader br = new BufferedReader(new FileReader(path));
    try {
        return br.readLine(); // 예외 발생 가능 (1)
    } finally {
        br.close(); // 예외 발생 가능 (2)
    }
}
```
**readLine()** 에서 예외 발생 후 **close()** 를 호출해 자원을 회수하려 했으나, 오히려 close()의 예외로 readLine()의 예외를 덮어씌워 실제 원인을 알기 힘들어진다.

## try-with-resources
```java
static String readFirstLine(String path) throws IOException {
    try (BufferedReader br = new BufferedReader(new FileReader(path))) {
        return br.readLine();
    }
}
```
반면에 이는 자동으로 close()를 호출하고, close()에서 발생한 예외는 suppressed로 기록해둔다.

# 궁금증

여기서 아래와 같은 궁금증이 생겼다.
1. 어떻게 자동으로 close()를 호출하고, suppressed로 기록을 해두는걸까?
2. 왜 try-with-resources 일까?

이 두 가지 궁금증에서 try-with-resources에 대해서 조금 더 알아보기로 했다.

## 1. AutoCloseable의 close()
> Java7 에서는 **명시적인 자원 해제를 보장**함과 동시에 **예외 처리를 개선**하기 위해 탄생한 인터페이스다.   
> **이 인터페이스는 단 하나의 메서드, close()만이 존재한다.**

위 예제에서 필자는 **BufferedReader**를 통한 예제코드를 작성했는데, 해당 객체를 보면  
**BufferedReader - Reader - Closeable - AutoCloseable**  
순서로 구현이 되어있다. 아래는 상속구조를 단순화하여 보여준 코드이다.
```java
// 1. AutoCloseable
public interface AutoCloseable {
    void close() throws Exception;
}

// 2. Closeable
public interface Closeable extends AutoCloseable {
    void close() throws IOException;
}

// 3. Reader
public abstract class Reader implements Readable, Closeable {
    public abstract void close() throws IOException;
}

// 4. BufferedReader
public class BufferedReader extends Reader {
    @Override
    public void close() throws IOException {
        synchronized (lock) {
            if (in == null) return;
            try {
                in.close();
            } finally {
                in = null;
                cb = null;
            }
        }
    }
}
```

컴파일러는 이를 아래와 같이 변환한다.
```java
BufferedReader br = new BufferedReader(new FileReader(path));
Throwable primaryException = null;
try {
    return br.readLine();
} catch (Throwable t) {
    primaryException = t;
    throw t;
} finally {
    if (br != null) {
        if (primaryException != null) {
            try {
                br.close();
            } catch (Throwable suppressedException) {
                primaryException.addSuppressed(suppressedException);
            }
        } else {
            br.close();
        }
    }
}
```

AutoCloseable의 close()를 구현하면,  
try 블록의 예외를 주 예외로 추적하고, close() 예외는 addSuppressed()로 연결한다.  
결과적으로 주 예외가 던져지며, close 예외는 getSuppressed()로 확인 가능하다.

### 자원 명세부의 제약
여기서 의문이 들었다.  
**AutoCloseable이 close() 하나만 있는데, 굳이 구현 안 하고 메서드 시그니처만 맞추면 안 될까?**  
이러한 의문을 바탕으로 조금 Deep Dive 해보니 try-with-resources의 자원 명세부에는 AutoCloseable 구현체만 선언 가능하다.
```java
// ✅ 정상
try (BufferedReader br = new BufferedReader(...)) {
    // ...
}

// ❌ 컴파일 에러
try (String str = "abcd") {
    // ...
}
```
try-with-resources의 자원 명세부는 **AutoCloseable 구현체만** 선언 가능하다.  
컴파일러가 컴파일 타임에 타입을 체크하기 때문이다.

## 2. 왜 try-with-resources 일까?
**resources**는 "자원"을 의미한다.  
여기서 자원이란 사용 후 반드시 해제해야 하는 시스템 리소스(파일, 네트워크 연결, DB 커넥션 등)를 의미한다.
```java
try (BufferedReader br = new BufferedReader(...)) {
    // ...
}
```

해당 코드를 보면, **br이 "resources"에 해당하는 "시스템 리소스"다.**

# 정리
> try-with-resources는 AutoCloseable을 구현한 자원에 대해 컴파일러가 자동으로 close()를 호출하고, 예외 발생 시 주 예외와 close 예외를 모두 추적할 수 있게 해준다.

우리는 시스템을 개발하며 여러 리소스를 할당하고 관리한다.  
이와 동시에 자원을 효율적으로 관리하지 못하면 메모리 누수, 파일 디스크립터 고갈, DB 커넥션 풀 부족 등으로 이어지며, 이는 **서비스 장애로** 직결된다.

그렇기에 try-finally를 통한 자원해제를 했었으나 이는 finally에서 발생한 예외가 try 블록의 예외를 덮어버리는 경우가 생기며 에러 추적이 어렵고, 코드도 복잡해진다.  
반면에 try-with-resources는 **컴파일러가 자동으로 자원 해제를 보장**하기에 기존의 위험을 원천에 차단할 수 있다.

**자원 관리는 선택이 아닌 서비스 안정성의 기본이라 생각한다.**
