package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.RefreshToken;
import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.repository.RefreshTokenRepository;
import com.grokdev.grokdev.repository.UserRepository;
import com.grokdev.grokdev.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("admin");
    }

    @Test
    void testCreateRefreshToken() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(testUser));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        RefreshToken token = refreshTokenService.createRefreshToken("admin");

        assertNotNull(token);
        assertNotNull(token.getToken());
        assertFalse(token.isRevoked());
        assertTrue(token.getExpiryDate().isAfter(Instant.now()));
        verify(refreshTokenRepository).deleteByUser(testUser);
        verify(refreshTokenRepository).save(any());
    }

    @Test
    void testVerifyExpiration_Valid() {
        RefreshToken token = new RefreshToken();
        token.setExpiryDate(Instant.now().plusSeconds(3600));
        token.setRevoked(false);

        RefreshToken result = refreshTokenService.verifyExpiration(token);

        assertEquals(token, result);
    }

    @Test
    void testVerifyExpiration_Expired() {
        RefreshToken token = new RefreshToken();
        token.setExpiryDate(Instant.now().minusSeconds(60));
        token.setRevoked(false);

        assertThrows(RuntimeException.class, () -> {
            refreshTokenService.verifyExpiration(token);
        });
    }

    @Test
    void testRevokeRefreshToken() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(testUser));

        refreshTokenService.revokeRefreshToken("admin");

        verify(refreshTokenRepository).deleteByUser(testUser);
    }
}
