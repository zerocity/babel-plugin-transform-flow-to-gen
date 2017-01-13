import {sample} from 'testcheck';
import * as types from '../typeHelpers';
import {loadFixture, expectType} from './helpers';
import asGenerator from '../asGenerator';

const isPerson = person => {
  expectType(person.firstName, `string`);
  expectType(person.middleName, `string`, true);
  expectType(person.lastName, `string`, true);
  expectType(person.age, `number`);
  expectType(person.isCool, `boolean`);
  expectType(person.isMonster, `boolean`);

  expect(person.isMonster).toEqual(false);
  expect([`blue`, `brown`, `green`]).toContain(person.misc.eyeColor);
  expect([`blonde`, `brown`, `red`]).toContain(person.misc.hairColor);

  expect(Array.isArray(person.favoriteFoods)).toBeTruthy();

  person.favoriteFoods.forEach(food => {
    expect([`pizza`, `ice cream`, `tacos`]).toContain(food);
  });
};

describe(`babel-plugin-transform-flow-to-gen`, () => {
  it(`works with simple types`, () => {
    const {Person, Job, Worker} = loadFixture(`types`);

    sample(asGenerator(Person)).forEach(isPerson);

    const other = types.object({
      a: types.string(),
      b: types.boolean(),
    });

    sample(asGenerator(Job, other)).forEach(job => {
      expectType(job.jobTitle, `string`);
      expectType(job.other, `object`);
      expectType(job.other.a, `string`);
      expectType(job.other.b, `boolean`);
    });

    sample(asGenerator(Job, types.string())).forEach(job => {
      expectType(job.other, `string`);
    });

    sample(asGenerator(Worker, other)).forEach(worker => {
      isPerson(worker);
      expectType(worker.jobTitle, `string`);
      expectType(worker.other.a, `string`);
    });
  });

  it(`handles special generics appropriately`, () => {
    const {Critic} = loadFixture(`types`);

    let foundMiscEyeColor = false;
    let foundMiscHairColor = false;

    sample(asGenerator(Critic)).forEach(critic => {
      expect(Array.isArray(critic.favoriteMovies)).toBeTruthy();
      expectType(critic.style, `object`);
      expect(critic.favoriteLetters).toEqual([`A`, `B`, `C`]);
      expect(parseInt(critic.numberToLetter, 10)).toBeGreaterThan(-1);

      expect(Array.isArray(critic.someKeys)).toBeTruthy();

      critic.someKeys.forEach(key => {
        expect([`A`, `BB`, `CCC`, `DDDD`]).toContain(key);
      });

      expect(Object.keys(critic.misc).length).toBeLessThanOrEqual(2);

      if (critic.misc.eyeColor) {
        foundMiscEyeColor = true;
      }

      if (critic.misc.hairColor) {
        foundMiscHairColor = true;
      }

      isPerson(critic.friend);
    });

    expect(foundMiscEyeColor).toEqual(true);
    expect(foundMiscHairColor).toEqual(true);
  });

  it(`can generate single mocks by just calling the function`, () => {
    const {Person} = loadFixture(`types`);

    const person = Person();

    expectType(person.firstName, `string`);
    expectType(person.lastName, `string`, true);
    expectType(person.age, `number`);
    expectType(person.isCool, `boolean`);

    expect([`blue`, `brown`, `green`]).toContain(person.misc.eyeColor);
    expect([`blonde`, `brown`, `red`]).toContain(person.misc.hairColor);

    expect(Array.isArray(person.favoriteFoods)).toBeTruthy();

    person.favoriteFoods.forEach(food => {
      expect([`pizza`, `ice cream`, `tacos`]).toContain(food);
    });
  });

  it(`works with simple function types`, () => {
    const {
      concat,
      setName,
      setNameThenCallback,
      setNameWithGeneric,
    } = loadFixture(`functions`);

    sample(asGenerator(concat)).forEach(args => {
      expect(concat(...args)).toEqual(args[0] + args[1]);
    });

    sample(asGenerator(setName)).forEach(args => {
      const [person, name] = args;
      const newPerson = setName(person, name);

      expect(newPerson).not.toEqual(person);
      expect(newPerson.name).toEqual(name);
      expect(typeof newPerson.other.eyeColor).toEqual(`string`);
    });

    sample(asGenerator(setNameThenCallback)).forEach(args => {
      const [person, name, fn] = args;

      // returns a jest mock
      expect(fn).toHaveBeenCalledTimes(0);

      setNameThenCallback(person, name, fn);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toEqual({
        ...person,
        name,
      });
    });

    sample(asGenerator(setNameWithGeneric, types.number())).forEach(args => {
      const [person] = args;

      expectType(person.name, `string`);
      expectType(person.age, `number`);
      expectType(person.other, `number`);
    });
  });
});
