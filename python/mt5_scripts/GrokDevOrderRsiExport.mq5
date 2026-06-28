//+------------------------------------------------------------------+
//| GrokDevOrderRsiExport.mq5                                        |
//| Writes MT5 built-in iRSI(14, Close) shift 0/1 to Common Files    |
//| Attach to any XAUUSD chart; enable Algo Trading.                 |
//+------------------------------------------------------------------+
#property copyright "Grok Dev"
#property version   "1.00"
#property strict

input string InpSymbol = "XAUUSD";
input int    InpPeriod = 14;
input int    InpTimerSec = 1;

#define OUT_FILE "grok_dev_order_rsi_mt5.json"

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
   ExportRsi();
  }

void ExportRsi()
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

   int h = FileOpen(OUT_FILE, FILE_WRITE|FILE_TXT|FILE_COMMON|FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("GrokDevOrderRsiExport: FileOpen failed ", GetLastError());
      return;
     }
   FileWriteString(h, json);
   FileClose(h);
  }

string TfBlock(string tfName, ENUM_TIMEFRAMES tf)
  {
   int handle = iRSI(InpSymbol, tf, InpPeriod, PRICE_CLOSE);
   if(handle == INVALID_HANDLE)
      return "\"" + tfName + "\":null";

   double rsi0[], rsi1[];
   ArraySetAsSeries(rsi0, true);
   ArraySetAsSeries(rsi1, true);

   if(CopyBuffer(handle, 0, 0, 1, rsi0) <= 0 ||
      CopyBuffer(handle, 0, 1, 1, rsi1) <= 0)
     {
      IndicatorRelease(handle);
      return "\"" + tfName + "\":null";
     }

   datetime t0 = iTime(InpSymbol, tf, 0);
   datetime t1 = iTime(InpSymbol, tf, 1);
   double c0 = iClose(InpSymbol, tf, 0);
   double c1 = iClose(InpSymbol, tf, 1);

   IndicatorRelease(handle);

   string block = "\"" + tfName + "\":{";
   block += "\"shift0\":{\"rsi\":" + DoubleToString(rsi0[0], 2) +
            ",\"close\":" + DoubleToString(c0, (int)SymbolInfoInteger(InpSymbol, SYMBOL_DIGITS)) +
            ",\"timeUtc\":\"" + TimeToString(t0, TIME_DATE|TIME_SECONDS) + "\"},";
   block += "\"shift1\":{\"rsi\":" + DoubleToString(rsi1[0], 2) +
            ",\"close\":" + DoubleToString(c1, (int)SymbolInfoInteger(InpSymbol, SYMBOL_DIGITS)) +
            ",\"timeUtc\":\"" + TimeToString(t1, TIME_DATE|TIME_SECONDS) + "\"}";
   block += "}";
   return block;
  }
