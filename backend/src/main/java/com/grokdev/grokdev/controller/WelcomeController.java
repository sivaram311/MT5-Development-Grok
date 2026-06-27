package com.grokdev.grokdev.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class WelcomeController {

    @GetMapping("/welcome")
    public ResponseEntity<Map<String, Object>> getWelcome() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Welcome to Grok Dev!");
        response.put("description", "Spring Boot + Angular Application");
        response.put("user", "Authenticated user");
        response.put("status", "success");
        return ResponseEntity.ok(response);
    }
}
