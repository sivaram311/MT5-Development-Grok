# SOLID Principles & Design Patterns

## SOLID in Grok Dev

### S - Single Responsibility
- `JwtUtil` → only token generation/validation
- `AuthController` → only auth endpoints
- `ProjectRepository` → only data access

### O - Open/Closed
- `UserDetailsService` interface allows swapping implementations
- Security filters can be extended

### L - Liskov Substitution
- All repositories implement JpaRepository contract correctly

### I - Interface Segregation
- Small focused interfaces (`UserRepository`, `ProjectRepository`)

### D - Dependency Inversion
- Controllers depend on abstractions (`UserService`, `JwtUtil`)
- Dependencies injected via constructor/field (Spring)

## Design Patterns

### Repository Pattern
Data access abstraction.

### Interceptor Pattern (Angular)
`AuthInterceptor` modifies requests transparently. It also implements **proactive refresh logic** before requests when the token is about to expire.

### Filter Chain (Spring Security)
`JwtAuthenticationFilter` + `UsernamePasswordAuthenticationFilter`

### DTOs
Inner classes used as simple DTOs (`LoginRequest`).

## Recommendations for Growth
- Introduce proper DTOs in separate package
- Add Command/Query separation (CQRS light)
- Use Strategy pattern for different auth providers in future

This keeps the codebase maintainable and testable.