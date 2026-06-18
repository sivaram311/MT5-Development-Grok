package com.grokdev.grokdev.controller;

import com.grokdev.grokdev.model.Project;
import com.grokdev.grokdev.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:4200")
public class ProjectController {

    @Autowired
    private ProjectRepository projectRepository;

    @GetMapping
    public ResponseEntity<List<Project>> getAllProjects() {
        return ResponseEntity.ok(projectRepository.findAll());
    }

    @GetMapping("/active")
    public ResponseEntity<List<Project>> getActiveProjects() {
        return ResponseEntity.ok(projectRepository.findByStatus("ACTIVE"));
    }
}
