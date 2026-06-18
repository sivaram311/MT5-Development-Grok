# Database Schema (grok_dev)

## Tables

### users
| Column      | Type         | Constraints          |
|-------------|--------------|----------------------|
| id          | SERIAL       | PK                   |
| username    | VARCHAR(50)  | UNIQUE, NOT NULL     |
| password    | VARCHAR(100) | NOT NULL (BCrypt)    |
| enabled     | BOOLEAN      | DEFAULT true         |
| created_at  | TIMESTAMP    | DEFAULT now()        |

### roles
| Column | Type        | Constraints |
|--------|-------------|-------------|
| id     | SERIAL      | PK          |
| name   | VARCHAR(50) | UNIQUE      |

### user_roles
Join table (many-to-many)
| Column  | Type   |
|---------|--------|
| user_id | BIGINT (FK) |
| role_id | BIGINT (FK) |

### projects
Demo content table
| Column      | Type         | Notes               |
|-------------|--------------|---------------------|
| id          | SERIAL       | PK                  |
| title       | VARCHAR(100) | NOT NULL            |
| description | TEXT         |                     |
| status      | VARCHAR(20)  | DEFAULT 'ACTIVE'    |
| created_by  | BIGINT       | FK → users          |
| created_at  | TIMESTAMP    |                     |

## Initial Data
- admin (ROLE_ADMIN)
- user1 (ROLE_USER)
- 3 sample projects

## Connection
Configured via `application.properties`:
```
spring.jpa.properties.hibernate.default_schema=grok_dev
spring.datasource.url=jdbc:postgresql://localhost:5432/postgres
```

`ddl-auto=update` will create tables on startup.