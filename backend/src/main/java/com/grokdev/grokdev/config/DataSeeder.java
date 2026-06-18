package com.grokdev.grokdev.config;

import com.grokdev.grokdev.model.Project;
import com.grokdev.grokdev.model.User;
import com.grokdev.grokdev.repository.ProjectRepository;
import com.grokdev.grokdev.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // Ensure admin user exists with the correct password (dev convenience)
        // IMPORTANT: set password BEFORE save to satisfy NOT NULL constraint on first creation
        User admin = userRepository.findByUsername("admin").orElseGet(() -> {
            User u = new User();
            u.setUsername("admin");
            u.setEnabled(true);
            return u;  // do not save yet
        });
        admin.setPassword(passwordEncoder.encode("admin123"));
        userRepository.save(admin);
        // Verify for dev (logs only prefix of hash)
        User check = userRepository.findByUsername("admin").orElse(null);
        String adminPw = (check != null ? check.getPassword() : null);
        boolean matches = (adminPw != null && passwordEncoder.matches("admin123", adminPw));
        System.out.println(">>> Admin credentials ensured: admin / admin123 (verified=" + matches + ", hashPrefix=" + (adminPw != null ? adminPw.substring(0, 10) : "n/a") + "...)");

        // Ensure test user
        User user1 = userRepository.findByUsername("user1").orElseGet(() -> {
            User u = new User();
            u.setUsername("user1");
            u.setEnabled(true);
            return u;  // do not save yet
        });
        user1.setPassword(passwordEncoder.encode("admin123"));
        userRepository.save(user1);
        User check1 = userRepository.findByUsername("user1").orElse(null);
        String user1Pw = (check1 != null ? check1.getPassword() : null);
        boolean matches1 = (user1Pw != null && passwordEncoder.matches("admin123", user1Pw));
        System.out.println(">>> user1 credentials ensured (verified=" + matches1 + ")");

        // Seed some demo projects if table empty (for welcome screen)
        if (projectRepository.count() == 0) {
            User adminUser = userRepository.findByUsername("admin").orElse(null);
            Project p1 = new Project();
            p1.setTitle("Grok Dev Platform");
            p1.setDescription("Core full-stack with JWT auth, refresh tokens and responsive UI.");
            p1.setStatus("ACTIVE");
            p1.setCreatedBy(adminUser);
            projectRepository.save(p1);

            Project p2 = new Project();
            p2.setTitle("Mobile Refactor");
            p2.setDescription("Realme P2 Pro phone + Realme Pad 2 tablet support.");
            p2.setStatus("IN_PROGRESS");
            p2.setCreatedBy(adminUser);
            projectRepository.save(p2);

            Project p3 = new Project();
            p3.setTitle("Token Security");
            p3.setDescription("Proactive refresh + role based UI.");
            p3.setStatus("PLANNED");
            p3.setCreatedBy(adminUser);
            projectRepository.save(p3);

            System.out.println(">>> Demo projects seeded");
        }
    }
}
