import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Country, State, City } from 'country-state-city';

export const locationController = {
  async getCountries(_req: AuthRequest, res: Response) {
    try {
      const countries = Country.getAllCountries();
      res.json(countries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getProvinces(req: AuthRequest, res: Response) {
    try {
      const country = req.query.country as string;
      if (!country) {
        return res.status(400).json({ error: 'country query parameter is required' });
      }
      const states = State.getStatesOfCountry(country);
      res.json(states);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getCities(req: AuthRequest, res: Response) {
    try {
      const country = req.query.country as string;
      const province = req.query.province as string;
      if (!country) {
        return res.status(400).json({ error: 'country query parameter is required' });
      }
      let cities;
      if (province) {
        cities = City.getCitiesOfState(country, province);
      } else {
        cities = City.getCitiesOfCountry(country);
      }
      res.json(cities);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
