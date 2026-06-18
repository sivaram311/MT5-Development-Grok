package com.grokdev.grokdev.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        // Set properties via reflection for test
        ReflectionTestUtils.setField(jwtUtil, "secret", "dGhpcyBpcyBhIHNlY3JldCBrZXkgZm9yIHRlc3RpbmcgdGhhdCBpcyBsb25nIGVub3VnaA=="); // base64 of test key
        ReflectionTestUtils.setField(jwtUtil, "jwtExpirationMs", 86400000L);
        ReflectionTestUtils.setField(jwtUtil, "refreshExpirationMs", 604800000L);
    }

    @Test
    void testGenerateAndValidateToken() {
        UserDetails userDetails = new User("testuser", "password", new ArrayList<>());
        String token = jwtUtil.generateToken(userDetails);

        assertNotNull(token);
        assertEquals("testuser", jwtUtil.extractUsername(token));
        assertTrue(jwtUtil.validateToken(token, userDetails));
    }

    @Test
    void testGenerateRefreshToken() {
        UserDetails userDetails = new User("testuser", "password", new ArrayList<>());
        String refreshToken = jwtUtil.generateRefreshToken(userDetails);

        assertNotNull(refreshToken);
        assertEquals("testuser", jwtUtil.extractUsername(refreshToken));
    }

    @Test
    void testExpiredToken() throws InterruptedException {
        // Short expiration for test
        ReflectionTestUtils.setField(jwtUtil, "jwtExpirationMs", 1L); // 1ms

        UserDetails userDetails = new User("testuser", "password", new ArrayList<>());
        String token = jwtUtil.generateToken(userDetails);

        Thread.sleep(10); // Wait for expiration

        assertFalse(jwtUtil.validateToken(token, userDetails));
    }
}
