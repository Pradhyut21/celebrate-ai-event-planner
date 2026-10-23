import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Flower2,
  Heart,
  Leaf,
  ListChecks,
  MapPin,
  Pencil,
  Sparkles,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import type { StoredEvent } from '../../shared/schema.js';
import type { Section } from '../types.js';
import { formatDate, money, remainingDays } from '../lib/format.js';
import { sumMoney } from '../lib/data.js';
import { BotanicalIllustration } from '../components/BotanicalIllustration.js';
import { StatCard } from '../components/StatCard.js';
import { TaskRow } from '../components/TaskRow.js';
import { BudgetChart } from '../components/BudgetChart.js';

export function Overview({
  event,
  setSection,
  toggleTask,
  onEdit,
}: {
  event: StoredEvent;
  setSection: (section: Section) => void;
  toggleTask: (id: string) => void;
  onEdit: () => void;
}): React.ReactElement {
  const completed = event.plan.tasks.filter((task) => task.completed).length;
  const allocated = sumMoney(event.plan.budget.map((item) => item.allocated));
  const actual = sumMoney(event.plan.budget.map((item) => item.actual));
  const nextTasks = [
    ...event.plan.tasks.filter((task) => !task.completed),
    ...event.plan.tasks.filter((task) => task.completed),
  ].slice(0, 3);
  const booked = event.plan.vendors.filter((vendor) => vendor.status === 'booked').length;
  const days = remainingDays(event.input.date);
  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">
            <span className="tiny-flower">✳</span> LESS STRESS. MORE CELEBRATING.
          </p>
          <h1>Celebrate beautifully.</h1>
          <p>Big moments start with a little thoughtful planning.</p>
        </div>
        <span className="today-date">
          {new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </section>
      <article className="event-hero">
        <div className="event-hero-content">
          <span className="badge paper">
            YOUR{' '}
            {event.input.type === 'community' ? 'COMMUNITY EVENT' : event.input.type.toUpperCase()}
          </span>
          <h2>{event.input.name}</h2>
          <div className="event-meta">
            <span>
              <CalendarDays size={15} />
              {formatDate(event.input.date)}
            </span>
            <span>
              <MapPin size={15} />
              {event.input.location}
            </span>
            <span>
              <Users size={15} />
              {event.input.guests} guests
            </span>
          </div>
          <div className="hero-bottom">
            <span className="countdown">
              <span className="countdown-dot" />
              {days > 0
                ? `${days} days to make it wonderful`
                : days === 0
                  ? 'Today is your day. Enjoy every moment.'
                  : 'Your celebration memories start here'}
            </span>
            <button className="text-button" onClick={onEdit}>
              Edit event <Pencil size={13} />
            </button>
          </div>
        </div>
        <BotanicalIllustration />
      </article>
      <div className="stats-grid">
        <StatCard
          label="Total budget"
          value={money(event.input.budget, event.input.currency)}
          detail={
            <>
              <span className={actual > event.input.budget ? 'text-danger' : ''}>
                {money(Math.abs(event.input.budget - actual), event.input.currency)}{' '}
                {actual > event.input.budget ? 'over budget' : 'remaining'}
              </span>
            </>
          }
          Icon={Wallet}
        />
        <StatCard
          label="Planning progress"
          value={`${Math.round((completed / Math.max(1, event.plan.tasks.length)) * 100)}%`}
          detail={
            <>
              <progress
                className="mini-progress"
                max={Math.max(1, event.plan.tasks.length)}
                value={completed}
                aria-label="Planning task completion"
              />
              {completed} of {event.plan.tasks.length} tasks done
            </>
          }
          Icon={ListChecks}
          tone="peach"
        />
        <StatCard
          label="Guest count"
          value={String(event.input.guests)}
          detail={`${money(event.input.budget / event.input.guests, event.input.currency)} budget per person`}
          Icon={Users}
          tone="lavender"
        />
        <StatCard
          label="Vendors booked"
          value={`${booked} / ${event.plan.vendors.length}`}
          detail={
            booked === event.plan.vendors.length
              ? 'Your team is coming together'
              : 'Find your perfect celebration team'
          }
          Icon={Store}
          tone="yellow"
        />
      </div>
      <div className="overview-columns">
        <article className="card next-tasks">
          <div className="card-heading">
            <div>
              <h3>A little progress, every day</h3>
              <p>Let’s take care of what’s next.</p>
            </div>
            <button className="text-button" onClick={() => setSection('timeline')}>
              View timeline <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="task-list">
            {nextTasks.map((task) => (
              <TaskRow key={task.id} task={task} onChange={() => toggleTask(task.id)} compact />
            ))}
          </div>
          <div className="card-footer">
            <span>
              <span className="status-dot" />
              {completed === event.plan.tasks.length
                ? 'Everything is checked off. You did it!'
                : 'Small steps. A celebration to remember.'}
            </span>
            <Heart size={15} />
          </div>
        </article>
        <article className="card budget-preview">
          <div className="card-heading">
            <div>
              <h3>Room for what matters</h3>
              <p>Your budget at a glance.</p>
            </div>
            <Wallet size={18} className="muted" />
          </div>
          <div className="budget-glance">
            <BudgetChart
              budget={event.plan.budget}
              currency={event.input.currency}
              total={allocated}
            />
            <ul className="budget-legend">
              {event.plan.budget.slice(0, 4).map((item, index) => (
                <li key={item.id}>
                  <span className={`category-dot dot-${index}`} />
                  <span>{item.category}</span>
                  <strong>{Math.round((item.allocated / event.input.budget) * 100)}%</strong>
                </li>
              ))}
            </ul>
          </div>
          <button className="full-width-link" onClick={() => setSection('budget')}>
            Manage budget <ArrowRight size={15} />
          </button>
        </article>
      </div>
      <div className="inspiration-heading">
        <div>
          <p className="eyebrow">A FEW THOUGHTFUL TOUCHES</p>
          <h2>Make it feel like you.</h2>
        </div>
        <button className="text-button" onClick={() => setSection('ideas')}>
          Explore ideas <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="inspiration-row">
        {event.plan.ideas.slice(0, 3).map((idea, index) => (
          <button
            className={`inspiration-tile inspiration-${index}`}
            key={idea.id}
            onClick={() => setSection('ideas')}
          >
            <span className="idea-icon">
              {index === 0 ? (
                <Flower2 size={26} />
              ) : index === 1 ? (
                <Leaf size={26} />
              ) : (
                <Heart size={26} />
              )}
            </span>
            <span>
              <strong>{idea.title}</strong>
              <small>{idea.description}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <div className="plan-summary">
        <Sparkles size={18} />
        <p>{event.plan.summary}</p>
      </div>
    </>
  );
}
