import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PreferencesService } from './preferences.service';
import { environment } from '../../environments/environment';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PreferencesService]
    });
    service = TestBed.inject(PreferencesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and maps legacy column keys', () => {
    service.load().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/preferences`);
    req.flush({
      preferences: JSON.stringify({
        grid: {
          D1: {
            visibility: { broker: true, ny: true, rsi: true },
            order: ['broker', 'open', 'close']
          }
        }
      })
    });

    const pref = service.getGridPref('D1');
    expect(pref.visibility['time']).toBe(true);
    expect(pref.visibility['nyTime']).toBe(true);
    expect(pref.order[0]).toBe('time');
  });

  it('patches partial grid preferences', () => {
    service.load().subscribe();
    http.expectOne(`${environment.apiUrl}/auth/preferences`).flush({ preferences: '{}' });

    service.saveGridPref('H1', { time: true, nyTime: false, istTime: true, open: true, high: true, low: true, close: true, rsi: true, tickVolume: false }, ['time', 'close']).subscribe();
    const patch = http.expectOne(`${environment.apiUrl}/auth/preferences`);
    expect(patch.request.method).toBe('PATCH');
    const body = JSON.parse(patch.request.body.preferences);
    expect(body.grid.H1).toBeDefined();
    patch.flush({ preferences: JSON.stringify({ grid: { H1: body.grid.H1 } }) });
  });
});
