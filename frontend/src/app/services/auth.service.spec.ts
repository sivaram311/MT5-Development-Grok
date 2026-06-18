import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should login and store tokens', () => {
    const mockResponse = {
      accessToken: 'fake-jwt',
      refreshToken: 'fake-refresh',
      username: 'admin'
    };

    service.login('admin', 'admin123').subscribe(response => {
      expect(response.accessToken).toBe('fake-jwt');
      expect(localStorage.getItem('access_token')).toBe('fake-jwt');
      expect(localStorage.getItem('refresh_token')).toBe('fake-refresh');
    });

    const req = httpMock.expectOne('http://localhost:8081/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should return null when no token', () => {
    expect(service.getToken()).toBeNull();
  });
});
