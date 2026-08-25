---
title: "정적 멤버와 static, 객체가 없어도 존재하는 이유"
date: "2026-08-25"
excerpt: "static은 단순히 객체마다 값이 공유된다는 의미일까? JVM의 클래스 로딩 과정과 메모리 관점에서 정적 멤버가 무엇인지 알아보자"
coverImage: ""
---
Java를 처음 공부할 때 누구나 보게되는 코드가 있다.
```java
public static void main(String[] args) {}
```
이 글은 왜 static 이고 main 일까? 라는 질문에서 시작한다.


# 정적 멤버

Java를 처음 공부할 때 static 변수는 보통 **모든 객체가 공유하는 변수** 라고 배우는데, 이건 틀린 설명은 아니지만 아래 코드에 대해서 완전히 설명하기 어렵다.

```java
public class User {
  public static int count = 0;
}
```

만약 count가 모든 User 객체가 공유하는 값이라면 한 가지 의문이 들 수 있다.

> User 객체를 생성하지 않았다면, count 는 어디에 존재하는가?
 
실제로 이 count 를 호출할 때 User 를 생성하지 않고도 count 에 접근이 가능하다.
```java
User.count;
```
물론 이 처럼 외부에서 접근하기 위해서는 접근 제어자가 허용되어야 하지만, 중요한건 new 를 통해 객체를 생성하지 않아도 변수를 사용할 수 있다는 것 이다.  
그렇다면 static 은 정말 **객체들이 공유하는 것**이라고만 이해하는것이 충분할까?  

## 인스턴스 멤버와 정적 멤버
static의 유무에 따라 인스턴스 멤버와 정적 멤버로 나뉘게 된다.
- static **없는** 멤버 : **인스턴스 멤버**  
- static **있는** 멤버 : **정적 멤버**  

인스턴스 멤버는 객체에 속해있기 때문에 객체마다 독립적으로 존재한다.  
아래 코드를 보면 이해가 쉬울 것 이다.

```java
User user1 = new User();
User user2 = new User();

user1.name = 'kim';
user2.name = 'park';
```

이 처럼 각 객체는 name 이라는 독립적인 **인스턴스 멤버**가 존재한다.  
다만, 정적 멤버는 객체가 여러개일 지라도 **하나의 클래스 단위로 종속**되어 있다.

클래스 단위라는게 이해가 안될텐데, 아래 선언을 보면 조금 이해가 쉬울 것 같다.

```java
User.age = 10
```

이 처럼 선언 할 경우, 모든 User 객체는 동일한 age를 바라보기 때문에 그 값은 모두 10이 된다.

즉, 인스턴스 멤버는 객체 단위이며 정적 멤버는 클래스 단위로 존재한다.

# 클래스는 언제 존재하는걸까?
그렇다면 여기서 처음의 의문으로 돌아가보자.
> 객체를 생성하지 않았는데 정적 멤버는 어떻게 존재할 수 있는거지?

이를 이해하기 위해서는 클래스가 언제 JVM에 올라오는지 알아야 한다.  JVM은 프로그램 실행에 필요한 클래스를 ClassLoader를 통해 메모리에 로드하며, 크게 아래와 같은 과정을 거친다.
```text
Loading → Linking → Initialization
```

이 중 Linking 과 Initialization 단계를 눈여겨 보면 좋다.  
**Linking** 에는 Verify, Prepare, Resolve 이렇게 총 3개의 단계가 존재하는데, 이 중 Prepare 단계에서 static으로 선언된 클래스 변수를 위한 메모리가 준비되고 기본값이 설정된다.

```java
public static int age = 10;
```
이 코드를 기반으로 보면, Prepare 단계에서 age 를 위한 공간이 준비되며, int 타입의 기본값인 0이 할당된다.  

이 후 **Initialization** 단계에서는  코드에 선언한 초기값이 적용된다.

즉, 정적 멤버는 객체가 생성될 때 만들어지는 것이 아니라 클래스가 로딩되고 초기화되는 과정에서 준비된다. 그렇기 때문에 별도의 객체를 생성하지 않아도 클래스 자체를 통해 정적 멤버에 접근할 수 있는 것이다.

# 그렇다면 main은 왜 static일까?

앞서 정적 멤버는 객체가 아닌 클래스에 속한다고 설명했다. 이는 변수뿐만 아니라 메서드도 동일하다.

```java
public class User() {
  public static void run() {}
}
```

run 메서드 역시 특정 User 객체에 속하지 않기 때문에 별도의 객체 생성 없이 호출할 수 있다.  

```java
public class Application() {
  public static void main(String[] args) {}
}
```

여기서 의문이 들 부분이 한 가지 있다.
> 어떻게 Application 의 main 이 진입점임을 알 수 있을까?

이는 java 소스코드를 컴파일하고 실행하는 과정을 보면 알 수 있다.

```shell
$ javac Application.java # Application.java 에 작성된 코드를 bytecode로 컴파일한다
$ java Application       # 컴파일된 코드를 java 런처를 통해 실행한다 
```

java Application을 실행하면 Java 런처는 Application 클래스를 실행 대상으로 삼고, Java의 실행 규약에 따라 main 메서드를 프로그램의 진입점으로 찾아 호출한다.  
그리고 main은 static 메서드이기 때문에 Application 객체를 별도로 생성하지 않고도 호출할 수 있다.

> 결국 main은 Java가 찾아야 하기 때문에 main이고, 객체 없이 실행해야 하기 때문에 static이다.


# 부록: 객체와 인스턴스
> JLS(Java Language Specification) 4.3.1에서는  
> **An object is a class instance or an array.** 즉, **객체는 클래스 인스턴스와 배열로 나뉜다** 라고 정의하고있다.

객체와 인스턴스는 흔히 비슷한 의미로 사용되어 둘의 차이를 구분하기 어렵다. 하지만 JLS의 정의를 보면 조금 더 명확하게 구분할 수 있다.

```java
new User();   // Object O, Class Instance O
new int[10];  // Object O, Class Instance X
```

new User()로 생성된 것은 객체이면서 User 클래스의 인스턴스다. 반면 new int[10]으로 생성된 배열 역시 객체지만 클래스 인스턴스는 아니다.  
즉, Java에서 객체(Object)는 클래스 인스턴스와 배열을 포함하는 개념이며, 우리가 흔히 말하는 인스턴스(Instance)는 일반적으로 클래스 인스턴스(Class Instance)를 의미한다.  
따라서 클래스를 구체화하여 생성된 객체는 객체이면서 동시에 해당 클래스의 인스턴스라고 할 수 있다.

```text
Object
- Class Instance → new User()
- Array          → new int[10]
```

결국 개발을 하며 클래스 기반의 객체를 주로 다루다 보니 객체와 인스턴스가 같은 의미처럼 사용되어 혼동하기 쉬운 것이라 생각된다.
