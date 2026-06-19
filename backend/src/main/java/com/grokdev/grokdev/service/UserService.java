package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
public class UserService implements UserDetailsService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        log.info("=== UserService.loadUserByUsername called for username='{}' ===", username);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> {
                    log.error("User NOT FOUND in DB for username='{}'", username);
                    return new UsernameNotFoundException("User not found: " + username);
                });

        String pw = user.getPassword();
        String pwPrefix = (pw != null && pw.length() > 10) ? pw.substring(0, 10) + "..." : (pw != null ? pw : "null");
        log.info("DB User loaded - id={}, username='{}', enabled={}, passwordHashPrefix='{}', passwordFullLength={}", 
            user.getId(), user.getUsername(), user.isEnabled(), pwPrefix, pw != null ? pw.length() : 0);

        org.springframework.security.core.userdetails.User userDetails = new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                user.isEnabled(),
                true, true, true,
                new ArrayList<>()  // No roles for basic
        );

        String detailsPwPrefix = (userDetails.getPassword() != null && userDetails.getPassword().length() > 10) 
            ? userDetails.getPassword().substring(0, 10) + "..." : "n/a";
        log.info("Returning Spring UserDetails - username='{}', passwordHashPrefix='{}'", 
            userDetails.getUsername(), detailsPwPrefix);

        return userDetails;
    }

    public User findByUsername(String username) {
        log.debug("UserService.findByUsername (entity) for '{}'", username);
        User u = userRepository.findByUsername(username).orElse(null);
        if (u != null) {
            String pwPrefix = (u.getPassword() != null && u.getPassword().length() > 10) ? u.getPassword().substring(0, 10) + "..." : "n/a";
            log.debug("findByUsername returned entity id={}, username='{}', pwPrefix='{}'", u.getId(), u.getUsername(), pwPrefix);
        } else {
            log.warn("findByUsername returned NULL for '{}'", username);
        }
        return u;
    }

    // For future registration if needed
    public User saveUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    public String getColumnPreferences(String username) {
        User u = findByUsername(username);
        return u != null ? u.getColumnPreferences() : null;
    }

    public void updateColumnPreferences(String username, String prefsJson) {
        User u = findByUsername(username);
        if (u != null) {
            u.setColumnPreferences(prefsJson);
            userRepository.save(u);
        }
    }
}
