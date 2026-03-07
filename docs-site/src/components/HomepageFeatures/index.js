import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'What is DiscountMate?',
    imgSrc: require('@site/static/img/discountmatemain.png').default,
    description: (
      <>
        DiscountMate is an automated price intelligence platform that collects, structures, and analyses grocery retail data across major supermarkets. 
        It provides insights on price trends, discount patterns, and competitive pricing strategies to help retailers and consumers make informed decisions.  
      </>
    ),
  },
  {
    title: 'The Documentation',
    imgSrc: require('@site/static/img/docs2.png').default,
    description: (
      <>
        Our documentation ensures reproducibility and continuity across semesters. 
        
        It covers scraping pipelines, computer vision workflows, web development, and deployment standards with the aim of moving the project from experimentation to production-ready systems.
      </>
    ),
  },
  {
    title: 'DataBytes Structure',
    imgSrc: require('@site/static/img/databytes.png').default,
    description: (
      <>
        DiscountMate operates within DataBytes, a multidisciplinary capstone technology organisation at Deakin University. 
        Projects share engineering standards, documentation, CI/CD, and cross-team collaboration to build scalable, real-world data solutions.
      </>
    ),
  },
];

function Feature({imgSrc, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {/* We use a standard <img> tag here. 
            Note: Docusaurus 3.x requires 'require().default' for local images. */}
        <img 
          src={imgSrc} 
          className={styles.featureSvg} 
          alt={title} 
          /*style={{width: '200px', height: '200px', objectFit: 'contain'}} */
          style={{width: '320px', height: '320px', objectFit: 'contain'}}
        />
      </div>
      <div className={clsx("text--center padding-horiz--md", styles.featureText)}>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
