package com.grokdev.grokdev.service;

import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("admin");
        testUser.setPassword("$2a$10$testencoded");
        testUser.setEnabled(true);
    }

    @Test
    void testLoadUserByUsername_Success() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(testUser));

        UserDetails userDetails = userService.loadUserByUsername("admin");

        assertNotNull(userDetails);
        assertEquals("admin", userDetails.getUsername());
    }

    @Test
    void testLoadUserByUsername_NotFound() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThrows(org.springframework.security.core.userdetails.UsernameNotFoundException.class,
                () -> userService.loadUserByUsername("unknown"));
    }

    @Test
    void testFindByUsername() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(testUser));

        User found = userService.findByUsername("admin");

        assertNotNull(found);
        assertEquals("admin", found.getUsername());
    }

    @Test
    void testSaveUser() {
        when(passwordEncoder.encode(any())).thenReturn("encodedPass");
        when(userRepository.save(any(User.class))).thenReturn(testUser);

        User saved = userService.saveUser(testUser);

        assertNotNull(saved);
        verify(passwordEncoder).encode(any());
        verify(userRepository).save(any());
    }
}
