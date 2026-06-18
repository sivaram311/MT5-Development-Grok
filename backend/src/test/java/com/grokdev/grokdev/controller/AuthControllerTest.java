package com.grokdev.grokdev.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.security.JwtUtil;
import com.grokdev.grokdev.service.RefreshTokenService;
import com.grokdev.grokdev.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthenticationManager authenticationManager;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private RefreshTokenService refreshTokenService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void loginSuccess() throws Exception {
        UserDetails userDetails = org.springframework.security.core.userdetails.User
                .withUsername("admin")
                .password("encoded")
                .authorities("ROLE_USER")
                .build();

        Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null);

        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(jwtUtil.generateToken(any())).thenReturn("fake-access-token");
        when(refreshTokenService.createRefreshToken("admin")).thenReturn(createMockRefreshToken());
        when(userService.findByUsername("admin")).thenReturn(createMockUser());

        AuthController.LoginRequest loginRequest = new AuthController.LoginRequest();
        loginRequest.setUsername("admin");
        loginRequest.setPassword("admin123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("fake-access-token"))
                .andExpect(jsonPath("$.refreshToken").exists());
    }

    private User createMockUser() {
        User user = new User();
        user.setUsername("admin");
        return user;
    }

    private com.grokdev.grokdev.model.RefreshToken createMockRefreshToken() {
        com.grokdev.grokdev.model.RefreshToken rt = new com.grokdev.grokdev.model.RefreshToken();
        rt.setToken("fake-refresh");
        return rt;
    }
}
