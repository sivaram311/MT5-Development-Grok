package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.RefreshToken;
import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.repository.RefreshTokenRepository;
import com.grokdev.grokdev.repository.UserRepository;
import com.grokdev.grokdev.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Transactional
    public RefreshToken createRefreshToken(String username) {
        log.info("=== RefreshTokenService.createRefreshToken for username='{}' ===", username);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> {
                    log.error("User not found in createRefreshToken for '{}'", username);
                    return new RuntimeException("User not found");
                });

        log.info("Found user for refresh: id={}, username='{}'", user.getId(), user.getUsername());

        // Revoke previous refresh token for this user
        log.debug("Deleting previous refresh tokens for user_id={}", user.getId());
        refreshTokenRepository.deleteByUser(user);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        // Generate a secure random token (or use JWT for refresh too, but here we use opaque + DB)
        String newToken = UUID.randomUUID().toString();
        refreshToken.setToken(newToken);
        refreshToken.setExpiryDate(Instant.now().plusSeconds(7 * 24 * 60 * 60)); // 7 days
        refreshToken.setRevoked(false);

        RefreshToken saved = refreshTokenRepository.save(refreshToken);
        String tokenPreview = newToken.length() > 8 ? newToken.substring(0, 8) + "..." : newToken;
        log.info("RefreshToken SAVED - id={}, tokenPreview={}, expiry={}, revoked={}", 
            saved.getId(), tokenPreview, saved.getExpiryDate(), saved.isRevoked());

        return saved;
    }

    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    @Transactional
    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().isBefore(Instant.now()) || token.isRevoked()) {
            refreshTokenRepository.delete(token);
            throw new RuntimeException("Refresh token was expired or revoked. Please login again.");
        }
        return token;
    }

    @Transactional
    public void revokeRefreshToken(String username) {
        userRepository.findByUsername(username).ifPresent(refreshTokenRepository::deleteByUser);
    }

    @Transactional
    public String generateNewAccessTokenFromRefresh(String refreshTokenStr) {
        log.info("generateNewAccessTokenFromRefresh called, tokenPreview={}", 
            refreshTokenStr != null && refreshTokenStr.length() > 8 ? refreshTokenStr.substring(0, 8) + "..." : "n/a");

        RefreshToken refreshToken = findByToken(refreshTokenStr)
                .map(this::verifyExpiration)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        User user = refreshToken.getUser();
        log.info("Refresh token valid, generating new access for user='{}'", user.getUsername());

        // For access token, we can load UserDetails or just use username
        // Here we create a simple UserDetails for JWT generation
        UserDetails userDetails = org.springframework.security.core.userdetails.User
                .withUsername(user.getUsername())
                .password(user.getPassword())
                .authorities("ROLE_USER") // simplistic
                .build();

        String newToken = jwtUtil.generateToken(userDetails);
        log.info("New access token generated from refresh");
        return newToken;
    }
}
