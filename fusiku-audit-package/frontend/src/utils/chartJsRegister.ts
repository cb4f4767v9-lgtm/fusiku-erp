import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

/**
 * Register Chart.js pieces for the dashboard bar chart.
 * react-chartjs-2 registers controllers when its module loads; scales/elements must be registered once.
 * Wrapped so Vite HMR / duplicate evaluation does not throw "already registered".
 */
try {
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
} catch {
  /* duplicate registration */
}
