import { readFileSync } from 'node:fs';
import { indexData } from '../../src/lib/data';
import type { RawData } from '../../src/lib/types';

export const raw = JSON.parse(readFileSync('public/data/ade-2026.json', 'utf8')) as RawData;
export const data = indexData(raw);
