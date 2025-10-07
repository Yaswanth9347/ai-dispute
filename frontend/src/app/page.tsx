"use client"
import React from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function HomePage(): JSX.Element {
  const router = useRouter()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>AI Dispute Resolver</h1>
        <p>Fair Solutions Based on Indian Law</p>
      </div>

      <div className={styles['animation-container']}>
        <div className={styles['scale-icon']}>
          <div className={styles['scale-beam']} />
          <div className={styles['scale-pole']} />
          <div className={styles['scale-base']} />
          <div className={`${styles['scale-pan']} ${styles.left}`}>
            <div className={styles['scale-chain']} />
          </div>
          <div className={`${styles['scale-pan']} ${styles.right}`}>
            <div className={styles['scale-chain']} />
          </div>
        </div>

        <div className={styles['gavel-container']}>
          <div className={styles.gavel}>
            <div className={styles['gavel-head']} />
          </div>
        </div>
      </div>

      <div className={styles['auth-buttons']}>
        <button className={`${styles.btn} ${styles['btn-login']}`} onClick={() => router.push('/auth/login')}>Login</button>
        <button className={`${styles.btn} ${styles['btn-signup']}`} onClick={() => router.push('/auth/register')}>Sign Up</button>
      </div>

      <div className={styles.disclaimer}>
        <h3>
          <div className={styles['disclaimer-icon']}>!</div>
          Disclaimer
        </h3>
        <p>
          This <strong>AI Dispute Resolver</strong> is designed to handle <strong>civil and small disputes only</strong>, and <strong>does not cover criminal cases</strong>. 
          This platform is not a substitute for a judge or legal authority and does not determine right or wrong. 
          Instead, it analyzes your problem and provides fair solutions based on <strong>Indian laws</strong> to help resolve your particular dispute. 
          For serious legal matters, please consult with a qualified legal professional.
        </p>
      </div>
    </div>
  )
}