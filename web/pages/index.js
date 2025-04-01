import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home({ versions }) {
  return (
    <div className={styles.container}>
      <Head>
        <title>Cursor 下载链接</title>
        <meta name="description" content="Cursor AI编辑器所有版本的下载链接" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          下载 <span className={styles.highlight}>Cursor</span>
        </h1>
        <p className={styles.subtitle}>选择任意版本下载Cursor AI编辑器</p>
        
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>版本</th>
                <th>日期</th>
                <th>Mac安装包</th>
                <th>Windows安装包</th>
                <th>Linux安装包</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.version + version.date}>
                  <td className={styles.versionCell}>
                    <span className={styles.versionNumber}>{version.version}</span>
                  </td>
                  <td>{version.date}</td>
                  <td>
                    {version.platforms['darwin-universal'] && 
                      <a className={styles.downloadLink} href={version.platforms['darwin-universal']}>通用版</a>}
                    {version.platforms['darwin-x64'] && 
                      <a className={styles.downloadLink} href={version.platforms['darwin-x64']}>x64</a>}
                    {version.platforms['darwin-arm64'] && 
                      <a className={styles.downloadLink} href={version.platforms['darwin-arm64']}>arm64</a>}
                  </td>
                  <td>
                    {version.platforms['win32-x64'] && 
                      <a className={styles.downloadLink} href={version.platforms['win32-x64']}>x64</a>}
                    {version.platforms['win32-arm64'] && 
                      <a className={styles.downloadLink} href={version.platforms['win32-arm64']}>arm64</a>}
                  </td>
                  <td>
                    {version.platforms['linux-x64'] && 
                      <a className={styles.downloadLink} href={version.platforms['linux-x64']}>x64</a>}
                    {version.platforms['linux-arm64'] && 
                      <a className={styles.downloadLink} href={version.platforms['linux-arm64']}>arm64</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <a
            href="https://www.cursor.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            Cursor 官网
          </a>
        </div>
      </footer>
    </div>
  );
}

// 构建时获取数据
export async function getStaticProps() {
  try {
    // 使用本地JSON文件
    const versions = require('../public/data/version-history.json').versions || [];
    
    return {
      props: {
        versions: versions.sort((a, b) => {
          // 按版本号排序（降序）
          return b.version.localeCompare(a.version, undefined, { numeric: true });
        }),
      },
    };
  } catch (error) {
    console.error('Error loading version data:', error);
    return {
      props: {
        versions: [],
      },
    };
  }
} 