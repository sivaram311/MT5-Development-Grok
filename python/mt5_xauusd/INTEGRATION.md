# Integration with Spring Boot + Angular (grok_dev)

The data is stored in the **same database and schema** (`grok_dev`) as your Spring Boot application.

This makes integration very easy.

## 1. Create JPA Entity (Example for D1)

```java
package com.grokdev.grokdev.model.market;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "XAUUSD_D1", schema = "grok_dev")
@Data
public class XauusdD1 {

    @Id
    private LocalDateTime time;

    private Double open;
    private Double high;
    private Double low;
    private Double close;

    @Column(name = "tick_volume")
    private Long tickVolume;

    private Integer spread;

    @Column(name = "real_volume")
    private Long realVolume;
}
```

You can create similar entities for H4, H1, M15, M5, M1.

## 2. Repository

```java
public interface XauusdD1Repository extends JpaRepository<XauusdD1, LocalDateTime> {
    List<XauusdD1> findByTimeBetweenOrderByTimeAsc(LocalDateTime from, LocalDateTime to);
}
```

## 3. Service + Controller (example)

You can expose endpoints like:
- GET /api/market/xauusd/D1?from=...&to=...
- Similar for other timeframes

## 4. Frontend (Angular)

Use the existing services to call these endpoints and display:
- Candlestick charts (using any charting library)
- Multi-timeframe analysis
- Gann calculations on the data

## Recommendation

Create a dedicated `market` or `data` package in Spring Boot for all MT5 data.

Let me know if you want me to generate the full set of entities, repositories, and a sample REST controller for all timeframes.
