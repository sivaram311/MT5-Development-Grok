package com.grokdev.grokdev.controller;

import com.grokdev.grokdev.model.RefreshToken;
import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.security.JwtUtil;
import com.grokdev.grokdev.service.RefreshTokenService;
import com.grokdev.grokdev.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        String username = loginRequest != null ? loginRequest.getUsername() : "<null>";
        String password = loginRequest != null ? loginRequest.getPassword() : "<null>";
        log.info("=== LOGIN ATTEMPT START ===");
        log.info("Received login request - username='{}', passwordLength={}, passwordPreview='{}'", 
            username, 
            password != null ? password.length() : 0,
            password != null && password.length() > 0 ? password.substring(0, Math.min(3, password.length())) + "***" : "<empty>");

        try {
            log.info("Calling authenticationManager.authenticate for '{}'", username);
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    loginRequest.getUsername(), 
                    loginRequest.getPassword()
                )
            );

            log.info("authenticationManager.authenticate SUCCEEDED for '{}'", username);
            log.info("Authentication details - name={}, authenticated={}, principalClass={}", 
                authentication.getName(), authentication.isAuthenticated(), 
                authentication.getPrincipal() != null ? authentication.getPrincipal().getClass().getSimpleName() : "null");

            SecurityContextHolder.getContext().setAuthentication(authentication);

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String detailsPwPrefix = (userDetails.getPassword() != null && userDetails.getPassword().length() > 10) 
                ? userDetails.getPassword().substring(0, 10) + "..." : "n/a";
            log.info("UserDetails from auth - username='{}', passwordHashPrefix='{}', authorities={}", 
                userDetails.getUsername(), detailsPwPrefix, userDetails.getAuthorities());

            log.info("Generating access token...");
            String accessToken = jwtUtil.generateToken(userDetails);
            String accessPrefix = (accessToken != null && accessToken.length() > 20) ? accessToken.substring(0, 20) + "..." : accessToken;
            log.info("Access token generated (prefix): {}", accessPrefix);

            log.info("Creating refresh token for username='{}'...", username);
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(username);
            String rtPrefix = (refreshToken != null && refreshToken.getToken() != null && refreshToken.getToken().length() > 8) 
                ? refreshToken.getToken().substring(0, 8) + "..." : "n/a";
            log.info("Refresh token created - id={}, tokenPrefix={}, userId={}", 
                refreshToken != null ? refreshToken.getId() : null,
                rtPrefix,
                (refreshToken != null && refreshToken.getUser() != null) ? refreshToken.getUser().getId() : null);

            log.info("Fetching final User entity via userService.findByUsername('{}')", username);
            User user = userService.findByUsername(username);
            if (user == null) {
                log.error("!!! CRITICAL: userService.findByUsername returned NULL for '{}' even though authentication succeeded and refresh token was created!", username);
                throw new RuntimeException("User entity not found after successful authentication");
            }
            log.info("Final User entity fetched - id={}, username='{}', enabled={}", 
                user.getId(), user.getUsername(), user.isEnabled());

            Map<String, Object> response = new HashMap<>();
            response.put("accessToken", accessToken);
            response.put("refreshToken", refreshToken.getToken());
            response.put("tokenType", "Bearer");
            response.put("username", user.getUsername());
            response.put("authenticated", true);
            response.put("message", "Login successful");

            log.info("=== LOGIN SUCCESS - returning tokens for '{}' ===", username);
            log.debug("Full success response keys: {}", response.keySet());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("!!! LOGIN FAILED for username='{}' - real exception: {} - {}", 
                username, e.getClass().getSimpleName(), e.getMessage(), e);
            Map<String, Object> error = new HashMap<>();
            error.put("message", "Invalid username or password");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            Map<String, Object> response = new HashMap<>();
            response.put("username", auth.getName());
            response.put("authenticated", true);

            // Simple role simulation for demo (in real app, load from DB)
            if ("admin".equals(auth.getName())) {
                response.put("roles", new String[]{"ROLE_ADMIN", "ROLE_USER"});
            } else {
                response.put("roles", new String[]{"ROLE_USER"});
            }

            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Not authenticated");
    }

    @GetMapping("/preferences")
    public ResponseEntity<?> getPreferences() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            String username = auth.getName();
            String prefs = userService.getColumnPreferences(username);
            Map<String, Object> response = new HashMap<>();
            response.put("preferences", prefs != null ? prefs : "{}");
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Not authenticated");
    }

    @PutMapping("/preferences")
    public ResponseEntity<?> updatePreferences(@RequestBody Map<String, String> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            String username = auth.getName();
            String prefsJson = body.get("preferences");
            userService.updateColumnPreferences(username, prefsJson);
            return ResponseEntity.ok(Map.of("message", "Preferences saved"));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Not authenticated");
    }

    @PatchMapping("/preferences")
    public ResponseEntity<?> patchPreferences(@RequestBody Map<String, String> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            String username = auth.getName();
            String patchJson = body.get("preferences");
            try {
                String merged = userService.mergeColumnPreferences(username, patchJson);
                Map<String, Object> response = new HashMap<>();
                response.put("message", "Preferences merged");
                response.put("preferences", merged != null ? merged : "{}");
                return ResponseEntity.ok(response);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Not authenticated");
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<?> logout() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            refreshTokenService.revokeRefreshToken(auth.getName());
        }
        SecurityContextHolder.clearContext();
        Map<String, String> response = new HashMap<>();
        response.put("message", "Logged out successfully");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<?> refreshToken(@RequestBody RefreshTokenRequest request) {
        try {
            String newAccessToken = refreshTokenService.generateNewAccessTokenFromRefresh(request.getRefreshToken());
            Map<String, Object> response = new HashMap<>();
            response.put("accessToken", newAccessToken);
            response.put("tokenType", "Bearer");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
        }
    }

    // DTO for refresh
    public static class RefreshTokenRequest {
        private String refreshToken;

        public String getRefreshToken() { return refreshToken; }
        public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    }

    // DTO
    public static class LoginRequest {
        private String username;
        private String password;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
}
