# syntax=docker/dockerfile:1.7

# Keep the base image immutable as well as human-readable. The digest is the
# multi-architecture manifest for eclipse-temurin:21.0.7_6-jdk-jammy.
FROM eclipse-temurin:21.0.7_6-jdk-jammy@sha256:746ad7128069fdaa77df1f06a0463ad50f4ae787648cbbcc6d6ab0e702e6c97e

ARG NODE_VERSION=22.17.0
ARG ANDROID_COMMAND_LINE_TOOLS_VERSION=13114758
ARG ANDROID_PLATFORM_VERSION=36
ARG ANDROID_COMPAT_BUILD_TOOLS_VERSION=35.0.0
ARG ANDROID_BUILD_TOOLS_VERSION=36.0.0
ARG BUILDER_UID=1000
ARG BUILDER_GID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    JAVA_HOME=/opt/java/openjdk \
    HOME=/home/android-builder \
    GRADLE_OPTS=-Dorg.gradle.daemon=false \
    PATH=/opt/node/bin:/opt/android-sdk/cmdline-tools/${ANDROID_COMMAND_LINE_TOOLS_VERSION}/bin:/opt/android-sdk/platform-tools:/opt/java/openjdk/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        unzip \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN curl --fail --location --retry 4 \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
        --output /tmp/node.tar.xz \
    && mkdir -p /opt/node \
    && tar -xJf /tmp/node.tar.xz --strip-components=1 -C /opt/node \
    && rm /tmp/node.tar.xz \
    && node --version \
    && npm --version

RUN curl --fail --location --retry 4 \
        "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_COMMAND_LINE_TOOLS_VERSION}_latest.zip" \
        --output /tmp/android-command-line-tools.zip \
    && mkdir -p "${ANDROID_HOME}/cmdline-tools" /tmp/android-command-line-tools \
    && unzip -q /tmp/android-command-line-tools.zip -d /tmp/android-command-line-tools \
    && mv /tmp/android-command-line-tools/cmdline-tools \
        "${ANDROID_HOME}/cmdline-tools/${ANDROID_COMMAND_LINE_TOOLS_VERSION}" \
    && rm -rf /tmp/android-command-line-tools /tmp/android-command-line-tools.zip \
    && yes | sdkmanager --licenses >/dev/null \
    && sdkmanager --install \
        "platform-tools" \
        "platforms;android-${ANDROID_PLATFORM_VERSION}" \
        "build-tools;${ANDROID_COMPAT_BUILD_TOOLS_VERSION}" \
        "build-tools;${ANDROID_BUILD_TOOLS_VERSION}" \
    && sdkmanager --list_installed

RUN if getent group "${BUILDER_GID}" >/dev/null; then \
        build_group="$(getent group "${BUILDER_GID}" | cut -d: -f1)"; \
    else \
        build_group=android-builder; \
        groupadd --gid "${BUILDER_GID}" "${build_group}"; \
    fi \
    && useradd --create-home --uid "${BUILDER_UID}" --gid "${build_group}" \
        --shell /bin/bash android-builder \
    && mkdir -p /workspace /home/android-builder/.gradle /home/android-builder/.npm \
    && chown -R android-builder:"${build_group}" \
        /workspace /home/android-builder

COPY --chmod=0755 docker/android/entrypoint.sh /usr/local/bin/android-container-entrypoint

USER android-builder
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/android-container-entrypoint"]
CMD ["info"]
