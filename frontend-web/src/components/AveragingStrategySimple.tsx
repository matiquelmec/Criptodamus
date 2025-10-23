import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Target,
  DollarSign,
  Shield,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AveragingLevel {
  level: number;
  price: number;
  distance: number;
  allocation: string;
  type: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AveragingRecommendation {
  type: string;
  message: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AveragingStrategyData {
  strategy: string;
  levels: AveragingLevel[];
  riskManagement: {
    maxTotalRisk: string;
    maxPositions: number;
    recommendedAllocation: Record<string, string>;
    safeguards: string[];
  };
  recommendations: AveragingRecommendation[];
  analysis?: any;
}

interface AveragingStrategyProps {
  data: AveragingStrategyData;
  symbol: string;
  direction: 'long' | 'short';
  currentPrice: number;
  entryPrice: number;
}

const AveragingStrategySimple: React.FC<AveragingStrategyProps> = ({
  data,
  symbol,
  direction,
  currentPrice,
  entryPrice
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatPrice = (price: number): string => {
    if (price > 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (price > 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatPercentage = (value: number): string => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'DCA': return <TrendingDown className="h-4 w-4" />;
      case 'PYRAMID': return <TrendingUp className="h-4 w-4" />;
      case 'SCALE_IN': return <Target className="h-4 w-4" />;
      case 'SCALE_OUT': return <DollarSign className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case 'DCA': return 'Dollar Cost Averaging - Promediación en retrocesos';
      case 'PYRAMID': return 'Pyramid Building - Añadir en ganancias';
      case 'SCALE_IN': return 'Scale In - Entrada gradual en soportes';
      case 'SCALE_OUT': return 'Scale Out - Salida gradual en resistencias';
      default: return 'Estrategia de promediación personalizada';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH': return 'bg-green-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const calculateDistanceFromCurrent = (levelPrice: number) => {
    return ((levelPrice - currentPrice) / currentPrice) * 100;
  };

  // Generar niveles simulados si no vienen del backend
  const simulatedLevels = [
    { level: 1, price: currentPrice * 0.97, distance: -3, allocation: '20%', type: 'DCA', confidence: 'HIGH' as const },
    { level: 2, price: currentPrice * 0.94, distance: -6, allocation: '25%', type: 'DCA', confidence: 'MEDIUM' as const },
    { level: 3, price: currentPrice * 0.91, distance: -9, allocation: '25%', type: 'DCA', confidence: 'MEDIUM' as const },
    { level: 4, price: currentPrice * 0.88, distance: -12, allocation: '30%', type: 'DCA', confidence: 'LOW' as const }
  ];

  const levels = data.levels.length > 0 ? data.levels : simulatedLevels;

  const getNextLevels = () => {
    return levels.filter(level => {
      const distance = calculateDistanceFromCurrent(level.price);
      return direction === 'long' ? distance < 0 : distance > 0;
    }).slice(0, 3);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStrategyIcon(data.strategy)}
            <CardTitle className="text-lg">
              Estrategia de Promediación: {data.strategy}
            </CardTitle>
            <Badge variant="outline" className="ml-2">
              {symbol}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {getStrategyDescription(data.strategy)}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alertas Críticas */}
        {data.recommendations.filter(r => r.priority === 'CRITICAL').map((rec, index) => (
          <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-3">
            <div className="flex items-start gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
              <span className="font-medium">{rec.message}</span>
            </div>
          </div>
        ))}

        {/* Próximos Niveles */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-gray-900">
            <Target className="h-4 w-4 text-gray-700" />
            Próximos Niveles de Entrada
          </h4>

          {getNextLevels().length > 0 ? (
            <div className="grid gap-2">
              {getNextLevels().map((level, index) => {
                const distanceFromCurrent = calculateDistanceFromCurrent(level.price);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-300">
                        Nivel {level.level}
                      </Badge>
                      <div>
                        <div className="font-bold text-gray-900 text-base">{formatPrice(level.price)}</div>
                        <div className="text-sm text-gray-600 font-medium">
                          {formatPercentage(distanceFromCurrent)} desde precio actual
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{level.allocation}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <div
                          className={`w-3 h-3 rounded-full ${getConfidenceColor(level.confidence)}`}
                        />
                        <span className="text-sm font-medium text-gray-700">{level.confidence}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay niveles de promediación disponibles</p>
            </div>
          )}
        </div>

        {/* Risk Management Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{data.riskManagement.maxTotalRisk}</div>
            <div className="text-sm font-medium text-blue-700">Riesgo Máximo</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{data.riskManagement.maxPositions}</div>
            <div className="text-sm font-medium text-blue-700">Entradas Máximas</div>
          </div>
        </div>

        {/* Stop Loss Options */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-gray-900">
            <Shield className="h-4 w-4 text-red-600" />
            Opciones de Stop Loss
          </h4>

          <div className="grid gap-3">
            {/* Stop Loss Conservador */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-red-900">Stop Loss Conservador</div>
                  <div className="text-sm text-red-700">Protección inmediata de la señal original</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-900">
                    ${((currentPrice || entryPrice) * 0.985).toFixed(2)}
                  </div>
                  <div className="text-xs text-red-600">-1.5% aprox</div>
                </div>
              </div>
            </div>

            {/* Stop Loss de Promediación */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-orange-900">Stop Loss de Promediación</div>
                  <div className="text-sm text-orange-700">Permite completar estrategia de promediación</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-900">
                    ${((currentPrice || entryPrice) * 0.85).toFixed(2)}
                  </div>
                  <div className="text-xs text-orange-600">-15% máximo</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="text-xs text-yellow-800">
              💡 <strong>Recomendación:</strong> Usa Stop Loss de Promediación solo si planeas ejecutar todos los niveles DCA
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Distribución de Capital */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Distribución de Capital Recomendada</h4>
              <div className="space-y-2">
                {Object.entries(data.riskManagement.recommendedAllocation).map(([level, percentage]) => (
                  <div key={level} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{level.replace(/([A-Z])/g, ' $1')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: percentage }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{percentage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Todos los Niveles */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Todos los Niveles Calculados</h4>
              <div className="space-y-2">
                {levels.map((level, index) => {
                  const distanceFromEntry = ((level.price - entryPrice) / entryPrice) * 100;
                  return (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Nivel {level.level}</Badge>
                        <span className="font-mono text-sm">{formatPrice(level.price)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{level.allocation}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPercentage(distanceFromEntry)} vs entrada
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reglas de Protección */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Reglas de Protección
              </h4>
              <div className="space-y-2">
                {data.riskManagement.safeguards.map((safeguard, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{safeguard}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recomendaciones */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Recomendaciones</h4>
          {data.recommendations.filter(r => r.priority !== 'CRITICAL').map((rec, index) => (
            <div
              key={index}
              className={`p-2 rounded border text-sm ${getPriorityColor(rec.priority)}`}
            >
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{rec.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Calculadora Rápida */}
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-green-700" />
            <span className="text-sm font-semibold text-green-800">Calculadora Rápida</span>
          </div>
          <div className="text-sm text-green-700">
            Con $10,000 de capital, entrada inicial recomendada: <span className="font-bold text-green-900">
              ${(10000 * 0.3).toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AveragingStrategySimple;