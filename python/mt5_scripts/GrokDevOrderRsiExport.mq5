//+------------------------------------------------------------------+
//| GrokDevOrderRsiExport.mq5                                         |
//| Exports MT5 built-in iRSI(14, Close) shift 0/1 to Common Files   |
//| for Python / Analyzer cross-verification.                          |
//| Attach to any XAUUSD chart; enable Algo Trading.                 |
//+------------------------------------------------------------------+
#property copyright "Grok Dev"
#property version   "2.00"
#property strict

//--- Inputs
input string InpSymbol         = "XAUUSD";  // Symbol to monitor
input int    InpPeriod         = 14;        // RSI period (match terminal iRSI)
input int    InpTimerSec       = 2;         // Timer interval (seconds)
input bool   InpNewBarOnly     = false;     // true = skip until M1 bar changes (saves I/O; shift0 updates less often)
input bool   InpEnableFileLog  = false;     // Write errors to Common Files log

//--- Output files (Terminal/Common/Files/)
#define OUT_FILE   "grok_dev_order_rsi_mt5.json"
#define TEMP_FILE  "grok_dev_order_rsi_mt5.tmp"
#define LOG_FILE   "grok_dev_order_rsi_log.txt"

datetime g_lastM1BarTime = 0;
int      g_logHandle     = INVALID_HANDLE;

//+------------------------------------------------------------------+
int OnInit()
  {
   if(!SymbolSelect(InpSymbol, true))
     {
      Print("GrokDevOrderRsiExport: ERROR — symbol ", InpSymbol, " not available");
      return(INIT_FAILED);
     }

   if(InpEnableFileLog)
     {
      g_logHandle = FileOpen(LOG_FILE, FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
      if(g_logHandle != INVALID_HANDLE)
         FileWriteString(g_logHandle, "=== GrokDevOrderRsiExport v2.0 started " +
                         TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + " UTC ===\n");
     }

   EventSetTimer(MathMax(1, InpTimerSec));
   Print("GrokDevOrderRsiExport v2.0 ready — ", InpSymbol,
         " | timer=", InpTimerSec, "s | NewBarOnly=", InpNewBarOnly);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();

   if(g_logHandle != INVALID_HANDLE)
     {
      FileWriteString(g_logHandle, "=== Stopped reason=" + IntegerToString(reason) +
                      " at " + TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + " UTC ===\n");
      FileClose(g_logHandle);
      g_logHandle = INVALID_HANDLE;
     }
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   ExportRsi();
  }

//+------------------------------------------------------------------+
void ExportRsi()
  {
   datetime m1BarTime = iTime(InpSymbol, PERIOD_M1, 0);
   if(InpNewBarOnly && m1BarTime == g_lastM1BarTime)
      return;

   g_lastM1BarTime = m1BarTime;

   string json = BuildJsonPayload();
   if(!AtomicWriteJson(json))
      LogError("Export failed — could not write JSON", GetLastError());
  }

//+------------------------------------------------------------------+
bool AtomicWriteJson(const string json)
  {
   int h = FileOpen(TEMP_FILE, FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(h == INVALID_HANDLE)
      return false;

   FileWriteString(h, json);
   FileClose(h);

   if(FileMove(TEMP_FILE, FILE_COMMON, OUT_FILE, FILE_COMMON))
      return true;

   // Fallback: direct overwrite if move unsupported
   ResetLastError();
   h = FileOpen(OUT_FILE, FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(h == INVALID_HANDLE)
      return false;

   FileWriteString(h, json);
   FileClose(h);
   return true;
  }

//+------------------------------------------------------------------+
string BuildJsonPayload()
  {
   ENUM_TIMEFRAMES tfs[] = {PERIOD_W1, PERIOD_D1, PERIOD_H4, PERIOD_H1, PERIOD_M15, PERIOD_M5, PERIOD_M1};
   string tfNames[] = {"W1", "D1", "H4", "H1", "M15", "M5", "M1"};

   string json = "{";
   json += "\"symbol\":\"" + InpSymbol + "\",";
   json += "\"period\":" + IntegerToString(InpPeriod) + ",";
   json += "\"source\":\"mt5_iRSI\",";
   json += "\"updatedAt\":\"" + TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + "\",";
   json += "\"timeframes\":{";

   for(int i = 0; i < ArraySize(tfs); i++)
     {
      if(i > 0) json += ",";
      json += TfBlock(tfNames[i], tfs[i]);
     }

   json += "}}";
   return json;
  }

//+------------------------------------------------------------------+
string TfBlock(string tfName, ENUM_TIMEFRAMES tf)
  {
   int handle = iRSI(InpSymbol, tf, InpPeriod, PRICE_CLOSE);
   if(handle == INVALID_HANDLE)
     {
      LogError("iRSI failed for " + tfName, GetLastError());
      return "\"" + tfName + "\":null";
     }

   double rsi0[], rsi1[];
   ArraySetAsSeries(rsi0, true);
   ArraySetAsSeries(rsi1, true);

   if(CopyBuffer(handle, 0, 0, 1, rsi0) <= 0 ||
      CopyBuffer(handle, 0, 1, 1, rsi1) <= 0)
     {
      IndicatorRelease(handle);
      LogError("CopyBuffer failed for " + tfName, GetLastError());
      return "\"" + tfName + "\":null";
     }

   datetime t0 = iTime(InpSymbol, tf, 0);
   datetime t1 = iTime(InpSymbol, tf, 1);
   double c0 = iClose(InpSymbol, tf, 0);
   double c1 = iClose(InpSymbol, tf, 1);

   IndicatorRelease(handle);

   if(t0 == 0 || t1 == 0)
      return "\"" + tfName + "\":null";

   int digits = (int)SymbolInfoInteger(InpSymbol, SYMBOL_DIGITS);

   string block = "\"" + tfName + "\":{";
   block += "\"shift0\":{\"rsi\":" + DoubleToString(rsi0[0], 4) +
            ",\"close\":" + DoubleToString(c0, digits) +
            ",\"timeUtc\":\"" + TimeToString(t0, TIME_DATE|TIME_SECONDS) + "\"},";
   block += "\"shift1\":{\"rsi\":" + DoubleToString(rsi1[0], 4) +
            ",\"close\":" + DoubleToString(c1, digits) +
            ",\"timeUtc\":\"" + TimeToString(t1, TIME_DATE|TIME_SECONDS) + "\"}";
   block += "}";
   return block;
  }

//+------------------------------------------------------------------+
void LogError(string msg, int errCode)
  {
   string line = TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + " UTC | " +
                 msg + " | err=" + IntegerToString(errCode);
   Print("GrokDevOrderRsiExport: ", line);

   if(InpEnableFileLog && g_logHandle != INVALID_HANDLE)
      FileWriteString(g_logHandle, line + "\n");
  }
//+------------------------------------------------------------------+
