import { FieldType, PanelPlugin } from '@grafana/data';

import { DEFAULT_ADAPTER } from './adapter/signalAdapter';
import { DEFAULT_MAX_BOXES } from './render/cap';

import { NoisePanel } from './NoisePanel';
import { SCENARIOS } from './demo/scenarios';
import { DEFAULT_SPIN_TEXT } from './render/QuietMode';
import {
  DEFAULT_QUIET_MARK,
  DEFAULT_SPIN,
  DEFAULT_TRANSITION_MS,
  DEFAULT_TRANSITION_STYLE,
  LIVE,
  NoiseOptions,
} from './types';

/** The 3D text's own settings only make sense while it is the screensaver. */
const is3d = (options: NoiseOptions) => options.quietMode && options.quietMark === '3d';

export const plugin = new PanelPlugin<NoiseOptions>(NoisePanel).setPanelOptions((builder) =>
  builder
    .addFieldNamePicker({
      path: 'nameField',
      name: 'Name',
      description: 'The column holding the service names. Leave empty to use the first text column.',
      category: ['Data'],
      settings: { filter: (field) => field.type === FieldType.string },
    })
    .addFieldNamePicker({
      path: 'valueField',
      name: 'Value',
      description: 'The column holding the numbers. Leave empty to use the first number column.',
      category: ['Data'],
      settings: { filter: (field) => field.type === FieldType.number },
    })
    .addRadio({
      path: 'reducer',
      name: 'Value to use',
      description: 'Which reading to use when a service has several.',
      category: ['Data'],
      defaultValue: 'last',
      settings: {
        options: [
          { value: 'last', label: 'Last' },
          { value: 'max', label: 'Worst' },
          { value: 'mean', label: 'Average' },
        ],
      },
    })
    .addRadio({
      path: 'direction',
      name: 'Worse when',
      description:
        'Which way the number runs. Availability and budget remaining go down as things get worse; burn rate and budget burned go up.',
      category: ['Thresholds'],
      defaultValue: DEFAULT_ADAPTER.direction,
      settings: {
        options: [
          { value: 'higher-is-worse', label: 'Higher' },
          { value: 'lower-is-worse', label: 'Lower' },
        ],
      },
    })
    .addNumberInput({
      path: 'warning',
      name: 'Warning',
      description:
        'The level at which a service starts to deserve the screen. Scores 1. Availability of 0.99 by default.',
      category: ['Thresholds'],
      defaultValue: DEFAULT_ADAPTER.warning,
    })
    .addNumberInput({
      path: 'critical',
      name: 'Critical',
      description:
        'The level at which a service is in real trouble. Scores 3, and keeps rising past it. Availability of 0.95 by default.',
      category: ['Thresholds'],
      defaultValue: DEFAULT_ADAPTER.critical,
    })
    .addBooleanSwitch({
      path: 'quietMode',
      name: 'Quiet mode',
      description: 'When nothing is wrong, move the mark around the screen instead of showing an empty panel.',
      category: ['Display'],
      defaultValue: true,
    })
    .addRadio({
      path: 'quietMark',
      name: 'Quiet mark',
      description: 'What to bounce around the screen when nothing is wrong.',
      category: ['Display'],
      defaultValue: DEFAULT_QUIET_MARK,
      settings: {
        options: [
          {
            value: 'dvd',
            label: 'DVD logo',
            description:
              'The DVD Video logo is a trademark of DVD Format/Logo Licensing Corporation, which does not endorse this plugin.',
          },
          { value: 'text', label: 'Our logo' },
          { value: '3d', label: '3D text' },
        ],
      },
      showIf: (options) => options.quietMode,
    })
    .addTextInput({
      path: 'spinText',
      name: '3D text',
      description: 'What the 3D screensaver spells out.',
      category: ['Display'],
      defaultValue: DEFAULT_SPIN_TEXT,
      settings: { placeholder: DEFAULT_SPIN_TEXT },
      showIf: is3d,
    })
    .addSliderInput({
      path: 'spinSize',
      name: '3D size',
      description: 'As a percentage of the largest the text can be and still stay on screen at every angle.',
      category: ['Display'],
      defaultValue: DEFAULT_SPIN.size,
      settings: { min: 40, max: 100, step: 5 },
      showIf: is3d,
    })
    .addSliderInput({
      path: 'spinDepth',
      name: '3D depth',
      description: 'How far the letters are extruded, in ems.',
      category: ['Display'],
      defaultValue: DEFAULT_SPIN.depth,
      settings: { min: 0.1, max: 0.8, step: 0.05 },
      showIf: is3d,
    })
    .addSliderInput({
      path: 'spinSpeed',
      name: '3D speed',
      description: 'How fast it turns, as a multiple of its natural pace.',
      category: ['Display'],
      defaultValue: DEFAULT_SPIN.speed,
      settings: { min: 0.25, max: 3, step: 0.25 },
      showIf: is3d,
    })
    .addRadio({
      path: 'spinMaterial',
      name: '3D material',
      description: 'Metallic catches a moving highlight; solid is lit without one.',
      category: ['Display'],
      defaultValue: DEFAULT_SPIN.material,
      settings: {
        options: [
          { value: 'metallic', label: 'Metallic' },
          { value: 'solid', label: 'Solid' },
        ],
      },
      showIf: is3d,
    })
    .addColorPicker({
      path: 'spinColour',
      name: '3D colour',
      category: ['Display'],
      defaultValue: DEFAULT_SPIN.colour,
      showIf: is3d,
    })
    .addBooleanSwitch({
      path: 'usePersistence',
      name: 'Grow with age',
      description: 'Give a problem more of the screen the longer it lasts.',
      category: ['Display'],
      defaultValue: true,
    })
    .addSliderInput({
      path: 'transitionMs',
      name: 'Transition',
      description: 'How long the boxes take to move and resize when the layout changes.',
      category: ['Display'],
      defaultValue: DEFAULT_TRANSITION_MS,
      settings: { min: 0, max: 1200, step: 50 },
    })
    .addRadio({
      path: 'transitionStyle',
      name: 'Appear and disappear',
      description:
        'How boxes come and go. Grow takes the space and gives it back. Flash also burns bright for a moment when something new breaks. Fade is gentler. None does not animate at all.',
      category: ['Display'],
      defaultValue: DEFAULT_TRANSITION_STYLE,
      settings: {
        options: [
          { value: 'grow', label: 'Grow' },
          { value: 'flash', label: 'Flash' },
          { value: 'fade', label: 'Fade' },
          { value: 'none', label: 'None' },
        ],
      },
    })
    .addSliderInput({
      path: 'maxBoxes',
      name: 'Most boxes on screen',
      description:
        'Past this, the worst problems keep their own box and the rest share one that says how many more there are. Nothing is hidden silently.',
      category: ['Display'],
      defaultValue: DEFAULT_MAX_BOXES,
      settings: { min: 4, max: 60, step: 1 },
    })
    .addSelect({
      path: 'demoScenario',
      name: 'Demo',
      description: 'Run a built-in example instead of using the query. For demos and development.',
      category: ['Demo'],
      defaultValue: LIVE,
      settings: {
        options: [
          { value: LIVE, label: 'Live data', description: 'Use the panel query.' },
          ...SCENARIOS.map((scenario) => ({
            value: scenario.id,
            label: scenario.name,
            description: scenario.description,
          })),
        ],
      },
    })
);
