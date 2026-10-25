import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

import { retryPolicy } from './ai/client';
retryPolicy.delayMs = 0;
