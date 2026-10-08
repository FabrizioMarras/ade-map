import { mount } from 'svelte';
import '../../app.css';
import '../../ui/ui.css';
import '../../help/help.css';
import { applyStoredTheme } from '../../lib/theme';
import InsightsHelp from './InsightsHelp.svelte';

applyStoredTheme();
mount(InsightsHelp, { target: document.getElementById('help')! });
