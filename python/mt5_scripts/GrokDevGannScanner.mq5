//+------------------------------------------------------------------+
//| GrokDevGannScanner.mq5                                           |
//| MT5 Gann intraday scanner — exports alert JSON to Common Files   |
//| Attach to XAUUSD M5/M15; enable Algo Trading.                    |
//+------------------------------------------------------------------+
#property copyright "Grok Dev"
#property version   "1.00"
#property strict

input string InpSymbol = "XAUUSD";
input ENUM_TIMEFRAMES InpTf = PERIOD_M5;
input int    InpAtrPeriod = 14;
input double InpAtrThreshold = 1.25;
input int    InpTimerSec = 2;

#define OUT_FILE "grok_dev_gann_scanner.json"

int OnInit()
  {
   EventSetTimer(InpTimerSec);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   ExportGannScan();
  }

double CalcAtr(int period)
  {
   double sum = 0;
   for(int i = 1; i <= period; i++)
     {
      double h = iHigh(InpSymbol, InpTf, i);
      double l = iLow(InpSymbol, InpTf, i);
      double pc = iClose(InpSymbol, InpTf, i + 1);
      double tr = MathMax(h - l, MathMax(MathAbs(h - pc), MathAbs(l - pc)));
      sum += tr;
     }
   return sum / period;
  }

void ExportGannScan()
  {
   double close0 = iClose(InpSymbol, InpTf, 0);
   double open0 = iOpen(InpSymbol, InpTf, 0);
   double pivot = iOpen(InpSymbol, PERIOD_M15, iBarShift(InpSymbol, PERIOD_M15, iTime(InpSymbol, InpTf, 0), true));
   if(pivot <= 0) pivot = open0;

   double atr = CalcAtr(InpAtrPeriod);
   double slope = atr > 0 ? atr : pivot * 0.0003;
   double equilibrium = pivot + 12 * slope;
   double deviation = close0 - equilibrium;
   double deviationAtr = atr > 0 ? deviation / atr : 0;

   string bias = "balanced";
   if(deviationAtr >= InpAtrThreshold) bias = "overextended_up";
   else if(deviationAtr <= -InpAtrThreshold) bias = "overextended_down";

   bool angleAlert = MathAbs(deviationAtr) >= InpAtrThreshold;
   string severity = angleAlert ? "medium" : "none";
   if(angleAlert && MathAbs(deviationAtr) >= InpAtrThreshold * 1.5) severity = "high";

   string json = "{";
   json += "\"symbol\":\"" + InpSymbol + "\",";
   json += "\"timeframe\":\"" + EnumToString(InpTf) + "\",";
   json += "\"updatedAt\":\"" + TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + "\",";
   json += "\"currentPrice\":" + DoubleToString(close0, 2) + ",";
   json += "\"pivotPrice\":" + DoubleToString(pivot, 2) + ",";
   json += "\"equilibriumPrice\":" + DoubleToString(equilibrium, 2) + ",";
   json += "\"deviationAtr\":" + DoubleToString(deviationAtr, 2) + ",";
   json += "\"bias\":\"" + bias + "\",";
   json += "\"angleAlert\":" + (angleAlert ? "true" : "false") + ",";
   json += "\"reversalAlert\":{";
   json += "\"severity\":\"" + severity + "\",";
   json += "\"active\":" + (severity != "none" ? "true" : "false") + ",";
   json += "\"setup\":\"" + (angleAlert ? "MT5 Gann 1x1 stretch — check dashboard confluence" : "No MT5 angle alert") + "\"";
   json += "}}";

   int h = FileOpen(OUT_FILE, FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("GrokDevGannScanner: FileOpen failed ", GetLastError());
      return;
     }
   FileWriteString(h, json);
   FileClose(h);
  }
