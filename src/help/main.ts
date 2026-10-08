import { mount } from 'svelte';
import '../app.css';
import '../ui/ui.css';
import { applyStoredTheme } from '../lib/theme';
import Help from './Help.svelte';
import './help.css';

applyStoredTheme();
mount(Help, { target: document.getElementById('help')! });
