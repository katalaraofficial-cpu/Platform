-- Migration 016: Add phone column to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;
