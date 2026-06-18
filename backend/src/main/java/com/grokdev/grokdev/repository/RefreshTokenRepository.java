package com.grokdev.grokdev.repository;

import com.grokdev.grokdev.model.RefreshToken;
import com.grokdev.grokdev.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByUser(User user);
    Optional<RefreshToken> findByUserAndRevokedFalse(User user);
}
