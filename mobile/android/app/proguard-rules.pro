# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Naver Login SDK
-keep class com.navercorp.nid.** { *; }
-dontwarn com.navercorp.nid.**
-keep class com.dooboolab.naverlogin.** { *; }

# Retrofit - 네이버 로그인 SDK가 내부적으로 Retrofit 2.9.0 + Kotlin suspend 함수를
# 쓴다. Retrofit이 R8 full mode 대응 규칙을 자체 포함하기 시작한 건 2.10.0부터라서,
# AGP 8의 기본값인 R8 full mode에서는 keep되지 않은 클래스의 제네릭 시그니처가
# 지워진다. 그러면 suspend 함수의 Continuation<...> 타입 인자가 raw Class로 읽히고
# Retrofit이 이걸 ParameterizedType으로 캐스팅하다 터진다:
#   "java.lang.ClassCastException: java.lang.Class cannot be cast to
#    java.lang.reflect.ParameterizedType"
# 이게 앱에서는 no_catagorized_error로 보였다. (2026-08-04)
# 아래는 Retrofit 공식 consumer proguard 규칙(2.11.0 기준)이다.
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

# Retrofit이 서비스 메서드의 파라미터 어노테이션을 리플렉션으로 읽는다.
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# R8 full mode는 Retrofit 인터페이스가 Proxy로만 생성되는 걸 몰라서 구현체가
# 없다고 판단하고 값을 null로 치환한다. 인터페이스를 명시적으로 keep해서 막는다.
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>

# 제네릭 시그니처가 보존되어야 하는 타입들 (이게 위 ClassCastException의 직접 원인)
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# Kakao Login SDK — 카카오 SDK는 AAR에 consumer proguard 규칙을 사실상 안 넣어준다
# (v2-user에 AppLifecycleObserver 두 줄이 전부).
# 카카오 SDK는 내부적으로 Gson을 쓰는데, Gson의 EnumTypeAdapter 생성자는 enum 상수를
# 이름으로 되찾는다:  classOfT.getField(constant.name())
# Enum.name()은 생성자에 박힌 원본 문자열("TokenNotFound")을 그대로 돌려주는 반면
# R8은 static 필드명을 a, b... 로 바꿔버려서 getField가 못 찾고 터진다:
#   "java.lang.NoSuchFieldException: TokenNotFound"
#   (com.kakao.sdk.common.model.ClientErrorCause.TokenNotFound)
# 이 예외는 OkHttp Dispatcher 백그라운드 스레드에서 나는 FATAL이라 JS try/catch로
# 못 막고 앱이 그대로 강제 종료된다. 증상 세 가지가 전부 이것 하나 때문이었다:
# 카카오 로그인 크래시, 카카오 로그아웃 크래시, 그리고 구글로 로그인해도 로그아웃 시
# 크래시(signOutAccount가 provider와 무관하게 항상 카카오 logout을 호출해서).
# (2026-08-07, minify를 켠 cc5a039 커밋부터 깨져 있었는데 그동안 테스트를 안 해서 늦게 발견)
-keep class com.kakao.sdk.** { *; }
-dontwarn com.kakao.sdk.**

# 위와 같은 Gson enum 패턴은 다른 라이브러리에서도 언제든 터질 수 있어서,
# enum 상수 이름은 전역으로 보존한다(난독화 대상에서만 빼는 거라 크기 영향은 미미).
-keepclassmembers enum * {
    <fields>;
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# expo-notifications — 라이브러리가 android/proguard-rules.pro에 아래 규칙을 갖고
# 있는데 build.gradle에 consumerProguardFiles로 등록해두지 않아 앱 R8에 적용되지
# 않는다. 실제로 mapping.txt를 보면 NotificationRequest가 Ad.g로 난독화된다.
#
# 예약 알림은 SharedPreferences에 자바 직렬화(ObjectOutputStream)로 저장되는데,
# 직렬화 바이트에는 클래스 이름과 serialVersionUID가 박힌다. NotificationRequest는
# serialVersionUID를 선언하지 않아 UID가 멤버 이름에서 계산되므로, 난독화되면
# 앱을 업데이트할 때마다 이름과 UID가 함께 바뀐다. 그러면 이전 버전이 저장해둔
# 예약을 읽지 못하고, 라이브러리가 예외를 조용히 삼켜서(catch -> null) 에러 없이
# 알림만 사라진다. 기기를 재부팅해 복원할 때도 같은 문제가 난다.
# (2026-08-25, 알림 미수신 조사)
-keep class expo.modules.notifications.** { *; }
