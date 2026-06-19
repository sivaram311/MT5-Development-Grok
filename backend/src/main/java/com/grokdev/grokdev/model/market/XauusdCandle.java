package com.grokdev.grokdev.model.market;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class XauusdCandle {

    private LocalDateTime time;
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal close;
    private Long tickVolume;
    private Integer spread;
    private Long realVolume;
    private Double rsi;
}
