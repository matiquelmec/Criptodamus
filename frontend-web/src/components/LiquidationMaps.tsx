/**
 * LIQUIDATION MAPS COMPONENT - MAPAS DE LIQUIDACIONES PROFESIONALES
 *
 * Componente React para análisis de liquidaciones y mapas de calor
 * Implementa las funcionalidades profesionales del PDF Memoria Agente
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { liquidationService, liquidationUtils } from '@/services/liquidationService';

interface LiquidationMapsProps {
  defaultSymbol?: string;
  defaultTimeframe?: string;
  autoRefresh?: boolean;
}

export const LiquidationMaps: React.FC<LiquidationMapsProps> = ({
  defaultSymbol = 'BTCUSDT',
  defaultTimeframe = '5m',
  autoRefresh = true
}) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [activeTab, setActiveTab] = useState('overview');

  // Query para análisis completo
  const {
    data: analysisData,
    isLoading: analysisLoading,
    error: analysisError,
    refetch: refetchAnalysis
  } = useQuery({
    queryKey: ['liquidation-analysis', symbol, timeframe],
    queryFn: () => liquidationService.getAnalysis(symbol, {
      timeframe,
      includeHeatmap: true,
      includeClusters: true,
      includeAlerts: true
    }),
    refetchInterval: autoRefresh ? 30000 : false, // Refresh cada 30 segundos
    enabled: !!symbol
  });

  // Query para heatmap específico
  const {
    data: heatmapData,
    isLoading: heatmapLoading
  } = useQuery({
    queryKey: ['liquidation-heatmap', symbol, timeframe],
    queryFn: () => liquidationService.getHeatmap(symbol, { timeframe }),
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: !!symbol && activeTab === 'heatmap'
  });

  // Query para clusters
  const {
    data: clustersData,
    isLoading: clustersLoading
  } = useQuery({
    queryKey: ['liquidation-clusters', symbol, timeframe],
    queryFn: () => liquidationService.getClusters(symbol, { timeframe }),
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: !!symbol && activeTab === 'clusters'
  });

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refetchAnalysis();
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      case 'extreme': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderOverview = () => {
    if (analysisLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 animate-pulse rounded"></div>
          ))}
        </div>
      );
    }

    if (analysisError) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            Error al cargar análisis de liquidaciones: {analysisError.message}
          </AlertDescription>
        </Alert>
      );
    }

    if (!analysisData) return null;

    return (
      <div className="space-y-6">
        {/* Resumen general */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {analysisData.summary.totalLiquidations}
              </div>
              <div className="text-sm text-gray-600">Total Liquidaciones</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {liquidationUtils.formatVolume(analysisData.summary.totalVolume)}
              </div>
              <div className="text-sm text-gray-600">Volumen Total</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {analysisData.clusters?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Clusters Detectados</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {analysisData.alerts?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Alertas Activas</div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas críticas */}
        {analysisData.alerts && analysisData.alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🚨 Alertas Críticas
                <Badge className={getRiskBadgeColor('critical')}>
                  {analysisData.alerts.filter(a => a.severity === 'critical').length} Críticas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysisData.alerts.slice(0, 5).map((alert, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">
                      {liquidationUtils.getSeverityIcon(alert.severity)}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-sm text-gray-600">
                        Impacto: {alert.impact} | Tipo: {alert.type}
                      </div>
                    </div>
                    <Badge className={getRiskBadgeColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Distribución Long vs Short */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Distribución de Liquidaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-green-600 mb-2">Liquidaciones LONG</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Cantidad:</span>
                    <span className="font-medium">{analysisData.summary.longLiquidations.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volumen:</span>
                    <span className="font-medium">
                      {liquidationUtils.formatVolume(analysisData.summary.longLiquidations.volume)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Apalancamiento Promedio:</span>
                    <span className="font-medium">
                      {analysisData.summary.longLiquidations.averageLeverage.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-red-600 mb-2">Liquidaciones SHORT</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Cantidad:</span>
                    <span className="font-medium">{analysisData.summary.shortLiquidations.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volumen:</span>
                    <span className="font-medium">
                      {liquidationUtils.formatVolume(analysisData.summary.shortLiquidations.volume)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Apalancamiento Promedio:</span>
                    <span className="font-medium">
                      {analysisData.summary.shortLiquidations.averageLeverage.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Niveles de riesgo */}
        <Card>
          <CardHeader>
            <CardTitle>⚠️ Niveles de Riesgo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Riesgo Inmediato</h4>
                <Badge className={getRiskBadgeColor(analysisData.riskLevels.immediate.level)}>
                  {analysisData.riskLevels.immediate.level}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">
                  {analysisData.riskLevels.immediate.count} liquidaciones cercanas
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Riesgo Corto Plazo</h4>
                <Badge className={getRiskBadgeColor(analysisData.riskLevels.shortTerm.level)}>
                  {analysisData.riskLevels.shortTerm.level}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">
                  {analysisData.riskLevels.shortTerm.count} liquidaciones potenciales
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-2">Riesgo Mediano Plazo</h4>
                <Badge className={getRiskBadgeColor(analysisData.riskLevels.mediumTerm.level)}>
                  {analysisData.riskLevels.mediumTerm.level}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">
                  {analysisData.riskLevels.mediumTerm.count} liquidaciones proyectadas
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderHeatmap = () => {
    if (heatmapLoading) {
      return <div className="h-64 bg-gray-200 animate-pulse rounded"></div>;
    }

    if (!heatmapData?.heatmap) {
      return (
        <Alert>
          <AlertDescription>No hay datos de mapa de calor disponibles</AlertDescription>
        </Alert>
      );
    }

    const { heatmap } = heatmapData;

    return (
      <Card>
        <CardHeader>
          <CardTitle>🔥 Mapa de Calor de Liquidaciones - {symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Información del mapa */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{heatmap.maxIntensity.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Intensidad Máxima</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{heatmap.hotspots}</div>
                <div className="text-sm text-gray-600">Zonas Críticas</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{heatmap.resolution}</div>
                <div className="text-sm text-gray-600">Resolución</div>
              </div>
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm font-medium">Intensidad:</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 bg-green-500" title="Safe"></div>
                <div className="w-4 h-4 bg-yellow-500" title="Caution"></div>
                <div className="w-4 h-4 bg-orange-500" title="Warning"></div>
                <div className="w-4 h-4 bg-red-500" title="Danger"></div>
                <div className="w-4 h-4 bg-red-800" title="Critical"></div>
              </div>
            </div>

            {/* Mapa de calor visual */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {heatmap.levels
                .filter(level => level.liquidationCount > 0)
                .sort((a, b) => b.intensity - a.intensity)
                .slice(0, 20)
                .map((level, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: level.color }}
                      title={level.riskLabel}
                    ></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          ${liquidationUtils.formatPrice(level.priceRange.center, symbol)}
                        </span>
                        <Badge className={getRiskBadgeColor(level.riskLabel.toLowerCase())}>
                          {level.riskLabel}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {level.liquidationCount} liquidaciones • {liquidationUtils.formatVolume(level.totalVolume)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{level.intensity.toFixed(1)}%</div>
                      <Progress value={level.intensity} className="w-20" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderClusters = () => {
    if (clustersLoading) {
      return <div className="h-64 bg-gray-200 animate-pulse rounded"></div>;
    }

    if (!clustersData?.clusters || clustersData.clusters.length === 0) {
      return (
        <Alert>
          <AlertDescription>No se detectaron clusters de liquidaciones significativos</AlertDescription>
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>🎯 Clusters de Liquidaciones - {symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Resumen de clusters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{clustersData.summary.totalClusters}</div>
                <div className="text-sm text-gray-600">Total Clusters</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {liquidationUtils.formatVolume(clustersData.summary.totalVolume)}
                </div>
                <div className="text-sm text-gray-600">Volumen Total</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{clustersData.summary.highRiskClusters}</div>
                <div className="text-sm text-gray-600">Alta Peligrosidad</div>
              </div>
            </div>

            {/* Lista de clusters */}
            <div className="space-y-3">
              {clustersData.clusters.map((cluster, index) => (
                <div key={cluster.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">
                        Cluster #{index + 1} - ${liquidationUtils.formatPrice(cluster.centerPrice, symbol)}
                      </h4>
                      <div className="text-sm text-gray-600">
                        Rango: ${liquidationUtils.formatPrice(cluster.minPrice, symbol)} -
                        ${liquidationUtils.formatPrice(cluster.maxPrice, symbol)}
                      </div>
                    </div>
                    <Badge className={getRiskBadgeColor(cluster.riskLevel)}>
                      {cluster.riskLevel}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Liquidaciones:</span>
                      <div className="font-medium">{cluster.liquidations.length}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Volumen:</span>
                      <div className="font-medium">{liquidationUtils.formatVolume(cluster.totalVolume)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Densidad:</span>
                      <div className="font-medium">{cluster.density}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Nivel de Riesgo:</span>
                      <div className="font-medium capitalize">{cluster.riskLevel}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔥 Mapas de Liquidaciones Profesionales
            <Badge className="bg-blue-100 text-blue-800">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSymbolSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Símbolo</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                className="max-w-xs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
              </select>
            </div>
            <Button type="submit">Analizar</Button>
            <Button type="button" variant="outline" onClick={() => refetchAnalysis()}>
              Actualizar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tabs con diferentes vistas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="heatmap">Mapa de Calor</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6">
          {renderHeatmap()}
        </TabsContent>

        <TabsContent value="clusters" className="mt-6">
          {renderClusters()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LiquidationMaps;