import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useAnalysisOverview, useRSI, useFibonacci, useSupportResistance, useBBWP, useConfluence } from '@/hooks/useAnalysis'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTopCryptos } from '@/hooks/useMarketData'

export const Analysis: React.FC = () => {
  const [symbol, setSymbol] = useState<string>('BTCUSDT')
  const [timeframe, setTimeframe] = useState<string>('4h')

  // Predefined lists for quick selection
  const TIMEFRAMES = ['1m','5m','15m','1h','4h','1d']
  // Dynamic symbols from backend top cryptos (fallback to static list)
  const { data: topCryptos } = useTopCryptos(20)
  const DEFAULT_SYMBOLS = [
    'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOTUSDT','LTCUSDT','LINKUSDT','MATICUSDT',
    'AVAXUSDT','UNIUSDT','ATOMUSDT','NEARUSDT','AAVEUSDT','FILUSDT','FTMUSDT','SANDUSDT','MANAUSDT','GALAUSDT'
  ]
  const SYMBOLS: string[] = Array.isArray(topCryptos)
    ? topCryptos.map((c: any) => (c.symbol ? String(c.symbol).replace('/', '') : '')).filter(Boolean)
    : DEFAULT_SYMBOLS

  const overview = useAnalysisOverview(symbol, timeframe)
  const rsi = useRSI(symbol, timeframe)
  const fib = useFibonacci(symbol, timeframe)
  const sr = useSupportResistance(symbol, timeframe)
  const bbwp = useBBWP(symbol, timeframe)
  const conf = useConfluence(symbol, timeframe)

  const refetchAll = () => {
    overview.refetch()
    rsi.refetch()
    fib.refetch()
    sr.refetch()
    bbwp.refetch()
    conf.refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Symbol</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-background"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-background"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>
        <Button onClick={refetchAll}>Refresh</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>General technical snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : overview.error ? (
              <p className="text-sm text-destructive">{(overview.error as Error).message}</p>
            ) : (
              (() => {
                const d = (overview.data as any)?.data || {}
                const summary = d.summary || {}
                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{symbol}</Badge>
                      <Badge variant="outline">TF: {timeframe}</Badge>
                      {typeof d.currentPrice === 'number' && (
                        <Badge>Price: {d.currentPrice.toFixed(2)}</Badge>
                      )}
                      {d.dataSource && (
                        <Badge variant={d.dataSource === 'real_ohlcv' ? 'outline' : 'destructive'}>
                          Source: {d.dataSource}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {summary.confluenceScore !== undefined && (
                        <Badge className={cn(
                          summary.confluenceScore >= 85 && 'bg-green-600 text-white',
                          summary.confluenceScore >= 65 && summary.confluenceScore < 85 && 'bg-yellow-600 text-white',
                          summary.confluenceScore < 65 && 'bg-orange-600 text-white'
                        )}>Confluence: {summary.confluenceScore}%</Badge>
                      )}
                      {summary.riskLevel && (
                        <Badge variant="outline">Risk: {summary.riskLevel}</Badge>
                      )}
                      {summary.recommendation && (
                        <Badge variant="outline">Reco: {summary.recommendation}</Badge>
                      )}
                    </div>
                    {d.timestamp && (
                      <div className="text-xs text-muted-foreground">Updated: {new Date(d.timestamp).toLocaleString()}</div>
                    )}
                    {Array.isArray(summary.keyLevels) && summary.keyLevels.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Key Levels</p>
                        <div className="flex flex-wrap gap-1">
                          {summary.keyLevels.slice(0, 6).map((lvl: any, i: number) => (
                            <Badge key={i} variant="outline">{lvl.type || 'level'}: {typeof lvl.price === 'number' ? lvl.price.toFixed(2) : lvl.price}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RSI</CardTitle>
            <CardDescription>Momentum and divergences</CardDescription>
          </CardHeader>
          <CardContent>
            {rsi.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : rsi.error ? (
              <p className="text-sm text-destructive">{(rsi.error as Error).message}</p>
            ) : (
              (() => {
                const d = (rsi.data as any)?.data || {}
                const current = d.current || {}
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Current:</span>
                      {typeof current.value === 'number' && (
                        <Badge>{current.value.toFixed(2)}</Badge>
                      )}
                      {current.status && <Badge variant="outline">{current.status}</Badge>}
                      {current.signal && <Badge variant="outline">{current.signal}</Badge>}
                    </div>
                    {Array.isArray(d.historical) && (
                      <div className="text-xs text-muted-foreground">
                        Last: {d.historical.slice(-10).map((v: number) => v.toFixed ? v.toFixed(1) : v).join(', ')}
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fibonacci</CardTitle>
            <CardDescription>Retracements and extensions</CardDescription>
          </CardHeader>
          <CardContent>
            {fib.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : fib.error ? (
              <p className="text-sm text-destructive">{(fib.error as Error).message}</p>
            ) : (
              (() => {
                const d = (fib.data as any)?.data || {}
                const summary = d.summary || {}
                return (
                  <div className="space-y-2">
                    {summary.direction && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Direction:</span>
                        <Badge variant="outline">{summary.direction}</Badge>
                      </div>
                    )}
                    {Array.isArray(summary.keyLevels) && summary.keyLevels.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Key Levels</p>
                        <div className="flex flex-wrap gap-1">
                          {summary.keyLevels.slice(0, 6).map((k: any, i: number) => (
                            <Badge key={i} variant="outline">{k.level}: {typeof k.price === 'number' ? k.price.toFixed(2) : k.price}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(d.extensions) && d.extensions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Extensions: {d.extensions.slice(0,2).map((e: any) => `${e.level}:${e.price?.toFixed ? e.price.toFixed(2) : e.price}`).join(' • ')}
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support & Resistance</CardTitle>
            <CardDescription>Key price levels</CardDescription>
          </CardHeader>
          <CardContent>
            {sr.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : sr.error ? (
              <p className="text-sm text-destructive">{(sr.error as Error).message}</p>
            ) : (
              (() => {
                const d = (sr.data as any)?.data || {}
                const rec = d.recommendation || {}
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {rec.nearestSupport?.price && (
                        <Badge variant="outline">Nearest Support: {rec.nearestSupport.price.toFixed ? rec.nearestSupport.price.toFixed(2) : rec.nearestSupport.price}</Badge>
                      )}
                      {rec.nearestResistance?.price && (
                        <Badge variant="outline">Nearest Resistance: {rec.nearestResistance.price.toFixed ? rec.nearestResistance.price.toFixed(2) : rec.nearestResistance.price}</Badge>
                      )}
                      {rec.trend && <Badge>Trend: {rec.trend}</Badge>}
                      {rec.tradingRange?.lower !== undefined && rec.tradingRange?.upper !== undefined && (
                        <Badge variant="outline">Range: {rec.tradingRange.lower.toFixed ? rec.tradingRange.lower.toFixed(0) : rec.tradingRange.lower} - {rec.tradingRange.upper.toFixed ? rec.tradingRange.upper.toFixed(0) : rec.tradingRange.upper}</Badge>
                      )}
                    </div>
                    {Array.isArray(d.psychologicalLevels) && d.psychologicalLevels.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Psychological: {d.psychologicalLevels.slice(0,3).map((p: any) => `${p.type}:${p.price}`).join(' • ')}
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BBWP</CardTitle>
            <CardDescription>Volatility context</CardDescription>
          </CardHeader>
          <CardContent>
            {bbwp.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : bbwp.error ? (
              <p className="text-sm text-destructive">{(bbwp.error as Error).message}</p>
            ) : (
              (() => {
                const d = (bbwp.data as any) || {}
                const data = d.data || d // backend puede devolver en data o plano
                if (!data) return <p className="text-sm text-muted-foreground">No data</p>
                const current = data.current || {}
                const stats = data.statistics || {}
                const recent = Array.isArray(data.recent) ? data.recent : []
                const last = recent.slice(-5)
                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {typeof current.value === 'number' && <Badge>BBWP: {current.value.toFixed(2)}</Badge>}
                      {current.interpretation?.status && (
                        <Badge variant="outline">{current.interpretation.status}</Badge>
                      )}
                      {current.interpretation?.signal && (
                        <Badge variant="outline">{current.interpretation.signal}</Badge>
                      )}
                      {typeof stats.average === 'number' && (
                        <Badge variant="outline">Avg: {stats.average.toFixed(1)}</Badge>
                      )}
                      {typeof stats.min === 'number' && (
                        <Badge variant="outline">Min: {stats.min.toFixed(1)}</Badge>
                      )}
                      {typeof stats.max === 'number' && (
                        <Badge variant="outline">Max: {stats.max.toFixed(1)}</Badge>
                      )}
                    </div>
                    {last.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Recent: {last.map((r: any) => r.value?.toFixed ? r.value.toFixed(1) : r.value).join(', ')}
                      </div>
                    )}
                    {current.interpretation?.description && (
                      <p className="text-xs">{current.interpretation.description}</p>
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confluence</CardTitle>
            <CardDescription>Score and factors</CardDescription>
          </CardHeader>
          <CardContent>
            {conf.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : conf.error ? (
              <p className="text-sm text-destructive">{(conf.error as Error).message}</p>
            ) : (
              (() => {
                const d = (conf.data as any)?.data || {}
                return (
                  <div className="space-y-2">
                    {typeof d.confluenceScore === 'number' && (
                      <Badge className={cn(
                        d.confluenceScore >= 85 && 'bg-green-600 text-white',
                        d.confluenceScore >= 65 && d.confluenceScore < 85 && 'bg-yellow-600 text-white',
                        d.confluenceScore < 65 && 'bg-orange-600 text-white'
                      )}>Score: {d.confluenceScore}%</Badge>
                    )}
                    {Array.isArray(d.confluenceFactors) && d.confluenceFactors.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Factors: {d.confluenceFactors.slice(0,5).join(' • ')}
                      </div>
                    )}
                    {d.recommendation && (
                      <div className="text-xs">
                        Recommendation: <Badge variant="outline">{d.recommendation}</Badge>
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
