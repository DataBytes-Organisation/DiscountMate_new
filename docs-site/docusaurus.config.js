// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'DiscountMate Docs',
  tagline: 'Smart Price Scraping & ML Predictions',
  favicon: 'img/discountmatemain.png',

  // The LIVE URL of your site (Notice the .io format)
  url: 'https://DataBytes-Organisation.github.io',
  
  // The PATH of your site (Usually matches your repo name)
  baseUrl: '/DiscountMate_new/',

  // GitHub pages deployment config.
  organizationName: 'DataBytes-Organisation', // Your GitHub org name
  projectName: 'DiscountMate_new',           // Your repo name
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Set this to your specific project's doc folder
          editUrl: 'https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/docs-site/',
        },
        blog: false, // Turned off to match the Redback documentation style
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'DiscountMate',
        logo: {
          alt: 'DiscountMate Logo',
          src: 'img/databytes.png', // Ensure you have a logo.svg in static/img/
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://github.com/DataBytes-Organisation/DiscountMate_new',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Introduction',
                to: '/docs/',
              },
            ],
          },
          {
            title: 'Project Links',
            items: [
              {
                label: 'Main Repository',
                href: 'https://github.com/DataBytes-Organisation/DiscountMate_new',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} DiscountMate Team. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;