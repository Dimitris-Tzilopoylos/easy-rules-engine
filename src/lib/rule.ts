import { ConditionFactory, type PathParseCache } from "./condition";
import { resolveOperators, type EngineOptions } from "./operators";
import { type IRule, type IContext, type IRuleSet } from "./types";
import type { ParsedQuery } from "./jspath";

export class Rule {
    private _conditions: ReturnType<typeof ConditionFactory.create>[];
    constructor(
        private readonly rule: IRule,
        private readonly options?: EngineOptions,
    ) {
        const operators = resolveOperators(this.options?.operators);
        const pathParseCache: PathParseCache = new Map<string, ParsedQuery>();
        const build = { operators, pathParseCache };
        this._conditions = this.rule.conditions.map((condition) =>
            ConditionFactory.create(condition, build),
        );
    }
    public evaluate(context: IContext): boolean {
        return this.evaluateConditions(context);
    }

    private evaluateConditions(context: IContext): boolean {
        const result =  this._conditions.every((condition) => condition.evaluate(context));
        if(this.rule.type === "permissive") {
            return result;
        } else if(this.rule.type === "restrictive" && !result) {
            return !result;
        } else {
            throw new Error("Invalid rule type");
        }
    }
}


 
export class RuleSet {
    private _rules: (Rule | RuleSet)[];
    constructor(
        private readonly ruleSet: IRuleSet,
        private readonly options?: EngineOptions,
    ) {
        this._rules = this.ruleSet.rules.map((rule) =>
            Factory.create(rule, this.options),
        );
    }

    public evaluate(context: IContext): boolean {
        return this.evaluateRules(context);
    }

    private evaluateRules(context: IContext): boolean {
        return this._rules.every((rule) => rule.evaluate(context));
    }
}



export class Factory {
    static create(rule: IRule | IRuleSet, options?: EngineOptions): Rule | RuleSet {
        if ("rules" in rule) {
            return new RuleSet(rule as IRuleSet, options);
        }
        return new Rule(rule as IRule, options);
    }
}