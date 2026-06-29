package com.grokdev.grokdev.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    @Lazy
    private UserDetailsService userDetailsService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/api/auth/login")
                || path.startsWith("/api/auth/refresh")
                || path.startsWith("/api/auth/logout");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String jwt = parseJwt(request);

        if (jwt != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                String username = jwtUtil.extractUsername(jwt);
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                if (jwtUtil.validateToken(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (JwtException | UsernameNotFoundException | IllegalArgumentException ex) {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");

        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }

        // EventSource cannot send Authorization header — query token on market SSE streams only.
        if (isMarketSseStream(request)) {
            String queryToken = request.getParameter("access_token");
            if (StringUtils.hasText(queryToken)) {
                return queryToken;
            }
        }

        return null;
    }

    /** Accept query access_token for any market xauusd stream endpoint. */
    private boolean isMarketSseStream(HttpServletRequest request) {
        String servletPath = request.getServletPath();
        if (StringUtils.hasText(servletPath) && servletPath.endsWith("/stream") && servletPath.startsWith("/api/market/xauusd/")) {
            return true;
        }
        String requestUri = request.getRequestURI();
        return StringUtils.hasText(requestUri)
                && requestUri.endsWith("/stream")
                && requestUri.contains("/api/market/xauusd/");
    }
}
