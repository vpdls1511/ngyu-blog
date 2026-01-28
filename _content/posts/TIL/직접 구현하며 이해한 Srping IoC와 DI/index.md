---
title: "3년차 개발자지만 Java 실무 1년차의 Spring 직접 구현기"
date: "2026-01-28"
excerpt: "Node 개발자에서 Java개발자로, 더 늦기전에 기본부터."
coverImage: ""
---

> 2년 넘게 Node 개발만 하다가 Java를 실무에서 사용한 지 1년이 채 되지 않았다.  
> Spring Boot는 매일 쓰지만, 내부 동작 원리는 막연했다.  
> "왜 @Component만 붙이면 Bean이 되지?", "어떻게 @Autowired가 자동으로 주입되지?"  
> 문서만 읽어서는 와닿지 않아 **직접 만들어보기로 했다.**  
> *해당 문서는 직접 공부하며 잊지 않기위한 기록용으로, 설명이 불친절할 수 있다.* 

# 왜 만들었나

Spring Boot의 핵심 기능을 구현해보고 싶었다.  
특히 IoC/DI는 Spring의 심장인데, 이를 제대로 이해하지 못한 채 사용하는 게 찝찝했다.

**목표는 명확했다:**
- IoC Container 직접 구현
- DI(Dependency Injection) 동작 원리 체득
- 추후 AOP까지 적용 (지금은 라우팅까지만)

토이 프로젝트지만 진지하게 접근했다.  
실무에서 "왜 이렇게 동작하지?"라는 질문에 답할 수 있는 개발자가 되고 싶었다.

# HTTP 서버부터 시작

Spring Boot 없이 웹 서버를 만들려면 가장 기본부터 구현해야 했다.

## ServerSocket으로 연결 수락

```java
ServerSocket serverSocket = new ServerSocket(8080);
while (true) {
    Socket socket = serverSocket.accept();
    executor.submit(new RequestProcessor(socket));
}
```

**ServerSocket**은 포트를 열고 클라이언트 연결을 기다린다.  
accept()가 호출되면 커널의 Accept Queue에서 연결을 가져와 Socket 객체를 반환한다.

처음엔 매번 새 Thread를 생성했다.

```java
new Thread(new RequestProcessor(socket)).start();  // 비효율!
```

하지만 이건 요청마다 Thread를 생성/해제하는 비효율적인 방식이다.  
**ExecutorService**로 Thread Pool을 만들어 개선했다.

```java
int poolSize = Math.max(Runtime.getRuntime().availableProcessors(), 2);
ExecutorService executor = Executors.newFixedThreadPool(poolSize);
```

CPU 코어 수만큼 Thread를 확보하되, 최소 2개는 보장한다.

## HTTP 요청/응답 파싱

HTTP는 텍스트 프로토콜이다.

```
GET /ping HTTP/1.1
Host: localhost:8080
Content-Type: text/html
```

**구조:**
1. Request Line (GET /ping HTTP/1.1)
2. Headers (Host: ...)
3. 빈 줄 (`\r\n\r\n`)
4. Body (선택)

이걸 파싱하는 게 첫 관문이었다.

```java
String requestLine = reader.readLine();  // "GET /ping HTTP/1.1"
String[] parts = requestLine.split(" ");
// parts[0] = "GET", parts[1] = "/ping", parts[2] = "HTTP/1.1"
```

**여기서 NullPointerException을 만났다.**

브라우저가 `/favicon.ico` 요청을 보낼 때 빈 요청이 들어오는 경우가 있었다.  
연결은 되었지만 데이터가 없는 상황이다.

```java
if (requestLine == null || requestLine.isEmpty()) {
    return null;  // 빈 요청 무시
}
```

이렇게 방어 코드를 추가했다.

## 리소스 관리

Socket은 열었으면 반드시 닫아야 한다.  
처음엔 수동으로 close()를 호출했다.

```java
Socket socket = ...;
try {
    // 처리
} finally {
    socket.close();  // 예외 발생하면?
}
```

**문제는 finally에서도 예외가 발생할 수 있다는 점이다.**

**try-with-resources로 개선:**

```java
try (
    Socket socket = connection;
    BufferedReader reader = new BufferedReader(...);
    OutputStream output = socket.getOutputStream()
) {
    // 처리
    // 예외 발생해도 자동으로 close() 호출!
}
```

AutoCloseable을 구현한 자원은 자동으로 정리된다.  
메모리 누수, 파일 디스크립터 고갈 같은 문제를 원천 차단할 수 있다.

# DI Container 구현 (핵심)

이제 본격적으로 Spring의 심장, **IoC Container**를 만들 차례다.

## @Component와 @Autowired

가장 먼저 애노테이션 정의부터 시작했다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Component {
}

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Autowired {
}
```

**@Retention(RUNTIME)이 핵심이다.**  
이게 없으면 런타임에 Reflection으로 읽을 수 없다.

처음엔 @Autowired를 TYPE으로 잘못 설정했다가 인식이 안 돼서 한참 헤맸다.  
필드에 붙는 애노테이션은 반드시 `ElementType.FIELD`여야 한다.

## BeanContainer (일급 컬렉션)

Bean을 저장하는 Container를 만들었다.

```java
public class BeanContainer {
    private final Map<Class<?>, Object> beans = new HashMap<>();
    
    public void register(Class<?> clazz, Object instance) {
        beans.put(clazz, instance);
    }
    
    public <T> T getBean(Class<T> clazz) {
        Object bean = beans.get(clazz);
        if (bean == null) {
            throw new IllegalStateException("Bean not found: " + clazz.getName());
        }
        return (T) bean;
    }
}
```

**일급 컬렉션 패턴이다.**  
Map을 감싸서 Bean 관리 책임만 가진다.

## ComponentScanner (Reflection의 마법)

@Component가 붙은 클래스를 찾아 Bean으로 등록하는 스캐너다.

```java
public void scan(String basePackage) throws Exception {
    // ① 패키지 → 경로 변환
    String path = basePackage.replace('.', '/');
    ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
    URL resource = classLoader.getResource(path);
    
    File directory = new File(resource.toURI());
    
    // ② .class 파일 찾기
    List<Class<?>> classes = findClasses(directory, basePackage);
    
    // ③ @Component 체크 및 등록
    for (Class<?> clazz : classes) {
        if (clazz.isAnnotation()) continue;  // 애노테이션 자체는 제외
        
        if (hasComponentAnnotation(clazz)) {
            Object instance = clazz.getDeclaredConstructor().newInstance();
            beanContainer.register(clazz, instance);
        }
    }
}
```

**Reflection으로 동적 Bean 생성.**  
Class.forName()으로 문자열을 클래스로 로드하고, newInstance()로 인스턴스를 생성한다.

## 메타 애노테이션 구조

Spring의 @Controller를 만들다가 발견한 패턴이다.

```java
@Component  // 메타 애노테이션!
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Controller {
}
```

**@Controller에 @Component를 붙이면:**
- @Controller만 붙여도 Bean으로 등록됨
- ComponentScanner가 메타 애노테이션까지 탐색

이걸 구현하려면 재귀 탐색이 필요하다.

```java
private boolean hasComponentAnnotation(Class<?> clazz) {
    if (clazz.isAnnotationPresent(Component.class)) {
        return true;
    }
    
    // 메타 애노테이션 탐색
    for (Annotation annotation : clazz.getAnnotations()) {
        if (annotation.annotationType().getPackage().getName().startsWith("java.lang")) {
            continue;  // Java 기본 애노테이션 제외
        }
        
        if (annotation.annotationType().isAnnotationPresent(Component.class)) {
            return true;  // @Controller가 @Component 가짐!
        }
    }
    
    return false;
}
```

Spring의 애노테이션 계층 구조가 이렇게 동작하는 거였다.

## DependencyInjector

Bean은 등록했으니 이제 의존성을 주입할 차례다.

```java
public void inject() throws Exception {
    for (Map.Entry<Class<?>, Object> entry : beanContainer.getAllBeans().entrySet()) {
        Object bean = entry.getValue();
        injectFields(bean);
    }
}

private void injectFields(Object bean) throws Exception {
    Class<?> clazz = bean.getClass();
    
    for (Field field : clazz.getDeclaredFields()) {
        if (field.isAnnotationPresent(Autowired.class)) {
            Class<?> fieldType = field.getType();
            Object dependency = beanContainer.getBean(fieldType);
            
            field.setAccessible(true);  // private 접근 허용
            field.set(bean, dependency);  // 주입!
        }
    }
}
```

**Reflection으로 필드 주입.**  
private 필드도 setAccessible(true)로 강제 접근한다.

## IoC vs DI 체득

직접 만들어보니 둘의 차이가 명확해졌다.

**IoC (Inversion of Control) = 제어의 역전**
```java
// 전통적 방식 (개발자가 제어)
UserService service = new UserService();

// IoC (Container가 제어)
UserService service = beanContainer.getBean(UserService.class);
```

**DI (Dependency Injection) = IoC를 구현하는 방법**
```java
@Component
public class UserController {
    @Autowired
    private UserService userService;  // Container가 주입!
}
```

**Bean = Container가 관리하는 싱글톤.**  
new로 직접 생성하면 의존성이 주입 안 된 빈 껍데기다.

# 자동 라우팅 시스템

switch문으로 라우팅하는 건 너무 원시적이다.

```java
// 이런 거 하기 싫었다
switch (request.path()) {
    case "/ping" -> ...
    case "/pong" -> ...
}
```

Spring처럼 선언적 라우팅을 만들고 싶었다.

## @GetMapping 구현

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface GetMapping {
    String value();  // URL 경로
}
```

사용 예시:

```java
@Controller
public class PingHandler {
    
    @Autowired
    private TestService testService;
    
    @GetMapping("/ping")
    public HttpResponse handle(HttpRequest request) {
        testService.test();
        return HttpResponse.ok(request, "<h1>Ping from DI Container!</h1>");
    }
}
```

**@Controller 붙이고 @GetMapping만 달면 끝.**

## HandlerMapper

URL과 메서드를 매핑하는 저장소다.

```java
public class HandlerMapper {
    private final Map<String, HandlerMethod> handlers = new HashMap<>();
    
    public void register(String url, Object controller, Method method) {
        handlers.put(url, new HandlerMethod(controller, method));
    }
    
    public HandlerMethod getHandler(String url) {
        return handlers.get(url);
    }
}

public record HandlerMethod(Object controller, Method method) {
    public Object invoke(Object... args) throws Exception {
        return method.invoke(controller, args);  // Reflection 호출
    }
}
```

**Map 조회는 O(1).**  
switch문보다 효율적이고 확장 가능하다.

## ControllerScanner

@GetMapping을 스캔해서 HandlerMapper에 등록한다.

```java
public void scan() throws Exception {
    for (Object bean : beanContainer.getAllBeans().values()) {
        Class<?> clazz = bean.getClass();
        
        if (clazz.isAnnotationPresent(Controller.class)) {
            scanMethods(bean, clazz);
        }
    }
}

private void scanMethods(Object controller, Class<?> clazz) throws Exception {
    for (Method method : clazz.getDeclaredMethods()) {
        if (method.isAnnotationPresent(GetMapping.class)) {
            GetMapping mapping = method.getAnnotation(GetMapping.class);
            String url = mapping.value();
            
            handlerMapper.register(url, controller, method);
        }
    }
}
```

**Bean 스캔 → 메서드 스캔 → 자동 등록.**

## 자동 라우팅 완성

```java
HandlerMethod handler = handlerMapper.getHandler(request.path());

if (handler == null) {
    return HttpResponse.notFound(request);
}

return (HttpResponse) handler.invoke(request);
```

**switch문 완전히 제거.**  
새 경로 추가는 Controller에 @GetMapping만 추가하면 된다.

**OCP(Open-Closed Principle) 준수.**

# 시행착오와 개선

## @Target 설정 실수

@Autowired를 처음에 TYPE으로 설정했다.

```java
@Target(ElementType.TYPE)  // ❌ 클래스용
public @interface Autowired { }

// 사용
@Autowired  // 컴파일 에러!
private TestService service;
```

**필드에 붙는 애노테이션은 FIELD여야 한다.**

```java
@Target(ElementType.FIELD)  // ✅ 필드용
public @interface Autowired { }
```

이 실수로 30분 헤맸다.

## 애노테이션 자체가 Bean 등록 시도

@Controller에 @Component를 붙였더니:

```
NoSuchMethodException: Controller.<init>()
```

**ComponentScanner가 Controller 애노테이션 자체를 Bean으로 등록하려 했다.**

```java
for (Class<?> clazz : classes) {
    if (clazz.isAnnotation()) {
        continue;  // 애노테이션 제외!
    }
    // ...
}
```

애노테이션 타입을 명시적으로 필터링해서 해결했다.

## Thread Pool 미사용

ExecutorService를 만들어놓고 실제론 매번 새 Thread를 생성하고 있었다.

```java
executor = Executors.newFixedThreadPool(poolSize);

// 하지만 사용은
new Thread(new RequestProcessor(...)).start();  // 의미 없음!
```

**executor.submit()으로 수정:**

```java
executor.submit(new RequestProcessor(socket, beanContainer, handlerMapper));
```

Thread Pool을 제대로 활용하게 되었다.

# 결론

> "Spring Boot 없이 직접 만들어보니 왜 Spring이 이렇게 설계되었는지 이해되었다."

**IoC/DI는 단순한 패턴이 아니다.**  
개발자가 객체 생성과 의존성 관리에서 해방되어 비즈니스 로직에만 집중할 수 있게 해주는 철학이다.

**@Component 하나로 Bean이 되고, @Autowired 하나로 주입된다.**  
그 뒤에는 Reflection, 메타 애노테이션, 싱글톤 관리라는 정교한 메커니즘이 숨어있었다.

**직접 구현하며 얻은 것:**
- Bean = Container 관리 싱글톤 (new 쓰면 안 됨)
- Reflection으로 동적 Bean 생성 및 주입
- 메타 애노테이션 구조 (@Controller → @Component)
- @Target/@Retention은 JVM 레벨 (직접 구현 불가)
- try-with-resources로 안전한 리소스 관리

**다음 단계:**
- 생성자 주입 지원
- AOP 구현 (Proxy Pattern)
- @PostMapping, 경로 변수 (`/user/{id}`)
- Request Body 파싱 (JSON)

Java 1년 차 개발자에게 이 경험은 큰 자산이 될 것이다.  
앞으로 Spring Boot를 사용할 때 "왜?"라는 질문에 자신 있게 답할 수 있을 것 같다.
