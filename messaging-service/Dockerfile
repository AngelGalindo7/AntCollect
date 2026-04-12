# Stage 1: Build the JAR file using Maven
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
# Copy the pom.xml and download dependencies (creating a cached layer)
COPY messaging-service/pom.xml .
RUN mvn dependency:go-offline -B
# Copy source code and build the application
COPY messaging-service/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Create a minimal, lightweight runtime image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# Copy ONLY the compiled JAR from the builder stage
COPY --from=builder /build/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]