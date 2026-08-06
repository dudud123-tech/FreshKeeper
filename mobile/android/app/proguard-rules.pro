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
