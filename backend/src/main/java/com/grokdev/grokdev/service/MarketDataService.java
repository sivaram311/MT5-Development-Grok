package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.market.XauusdCandle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class MarketDataService {

    private final JdbcTemplate jdbcTemplate;

    private static final String SCHEMA = "grok_dev";

    @Autowired
    public MarketDataService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<XauusdCandle> getXauusdData(String timeframe, LocalDateTime from, LocalDateTime to, int limit) {
        String tableName = "XAUUSD_" + timeframe.toUpperCase();
        String sql = String.format(
                "SELECT time, open, high, low, close, tick_volume, spread, real_volume " +
                "FROM %s.\"%s\" " +
                "WHERE 1=1 ",
                SCHEMA, tableName
        );

        StringBuilder where = new StringBuilder();
        List<Object> paramsList = new ArrayList<>();

        if (from != null) {
            where.append(" AND time >= ? ");
            paramsList.add(from);
        }
        if (to != null) {
            where.append(" AND time <= ? ");
            paramsList.add(to);
        }
        sql += where.toString();
        sql += " ORDER BY time ASC LIMIT ?";
        paramsList.add(limit);

        Object[] params = paramsList.toArray();

        RowMapper<XauusdCandle> rowMapper = (rs, rowNum) -> XauusdCandle.builder()
                .time(rs.getTimestamp("time").toLocalDateTime())
                .open(rs.getBigDecimal("open"))
                .high(rs.getBigDecimal("high"))
                .low(rs.getBigDecimal("low"))
                .close(rs.getBigDecimal("close"))
                .tickVolume(rs.getLong("tick_volume"))
                .spread(rs.getInt("spread"))
                .realVolume(rs.getLong("real_volume"))
                .build();

        return jdbcTemplate.query(sql, rowMapper, params);
    }

    public List<XauusdCandle> getLatestXauusdData(String timeframe, int limit) {
        return getXauusdData(timeframe, null, null, limit);
    }
}
