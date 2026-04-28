/**
 * AI Repair Assistant - Suggests causes, steps, estimated cost
 * Based on device model, fault description, historical repairs
 */
import { prisma } from '../utils/prisma';

export interface RepairSuggestion {
  possibleCauses: string[];
  recommendedSteps: string[];
  estimatedCostMin: number;
  estimatedCostMax: number;
  similarRepairs: number;
}

const FAULT_KEYWORDS: Record<string, { causes: string[]; steps: string[]; costRange: [number, number] }> = {
  screen: { causes: ['Cracked display', 'LCD damage', 'Touch failure'], steps: ['Inspect screen', 'Replace display assembly', 'Test touch'], costRange: [80, 250] },
  battery: { causes: ['Battery degradation', 'Charging circuit'], steps: ['Check battery health', 'Replace battery', 'Test charging'], costRange: [30, 80] },
  charge: { causes: ['Charging port damage', 'Cable/connector', 'Battery'], steps: ['Inspect port', 'Clean connector', 'Replace if needed'], costRange: [25, 100] },
  camera: { causes: ['Lens damage', 'Sensor failure', 'Software'], steps: ['Test cameras', 'Replace module if needed'], costRange: [40, 150] },
  speaker: { causes: ['Speaker damage', 'Water damage', 'Connector'], steps: ['Test audio', 'Replace speaker'], costRange: [20, 60] },
  microphone: { causes: ['Mic blockage', 'Water damage'], steps: ['Clean mic', 'Replace if needed'], costRange: [15, 50] },
  water: { causes: ['Liquid damage', 'Corrosion'], steps: ['Disassemble', 'Clean', 'Dry', 'Replace damaged parts'], costRange: [50, 200] },
  power: { causes: ['Battery', 'Power IC', 'Charging port'], steps: ['Diagnose power circuit', 'Replace faulty component'], costRange: [40, 180] },
  wifi: { causes: ['Antenna', 'WiFi module', 'Software'], steps: ['Check antenna connection', 'Reset network', 'Replace module'], costRange: [30, 120] },
  bluetooth: { causes: ['Bluetooth module', 'Antenna'], steps: ['Test BT', 'Replace module if needed'], costRange: [25, 80] },
  touch: { causes: ['Digitizer', 'Screen', 'Flex cable'], steps: ['Test touch', 'Replace digitizer/screen'], costRange: [60, 200] },
  boot: { causes: ['Software', 'Storage', 'Power'], steps: ['Try recovery mode', 'Reflash', 'Check storage'], costRange: [30, 150] }
};

export const repairAssistantService = {
  async getSuggestions(deviceModel: string, faultDescription: string, opts: { companyId: string }): Promise<RepairSuggestion> {
    const fault = faultDescription.toLowerCase();
    const causes: string[] = [];
    const steps: string[] = [];
    let costMin = 20;
    let costMax = 150;
    const companyId = String(opts.companyId || '').trim();

    for (const [keyword, data] of Object.entries(FAULT_KEYWORDS)) {
      if (fault.includes(keyword)) {
        causes.push(...data.causes);
        steps.push(...data.steps);
        costMin = Math.min(costMin, data.costRange[0]);
        costMax = Math.max(costMax, data.costRange[1]);
      }
    }

    if (causes.length === 0) {
      causes.push('Further diagnosis required');
      steps.push('Inspect device', 'Identify fault', 'Quote repair');
    }

    const uniqueCauses = [...new Set(causes)];
    const uniqueSteps = [...new Set(steps)];

    const similarRepairs = await prisma.repair.count({
      where: {
        companyId,
        faultDescription: { contains: fault.split(' ')[0] || fault },
        status: 'completed'
      }
    });

    const avgCost = await prisma.repair.aggregate({
      where: {
        companyId,
        faultDescription: { contains: fault.split(' ')[0] || fault },
        status: 'completed'
      },
      _avg: { repairCost: true }
    });

    if (avgCost._avg && avgCost._avg.repairCost) {
      const avg = Number(avgCost._avg.repairCost);
      costMin = Math.round(avg * 0.7);
      costMax = Math.round(avg * 1.3);
    }

    return {
      possibleCauses: uniqueCauses.slice(0, 5),
      recommendedSteps: uniqueSteps.slice(0, 6),
      estimatedCostMin: costMin,
      estimatedCostMax: costMax,
      similarRepairs
    };
  }
};
